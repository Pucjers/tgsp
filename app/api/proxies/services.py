import uuid
import datetime
import requests
import socket
import time
import concurrent.futures
from typing import Dict, Any, List, Optional
from flask import current_app

from app.models.proxy import Proxy
from app.utils.file_utils import get_proxies, save_proxies, get_accounts, save_accounts, update_account_proxy


def get_all_proxies() -> List[Dict[str, Any]]:
    """
    Get all proxies
    
    Returns:
        List of proxy dictionaries
    """
    proxies = get_proxies()
    return proxies


def get_proxy_by_id(proxy_id: str) -> Optional[Dict[str, Any]]:
    """
    Get a single proxy by its ID
    
    Args:
        proxy_id: ID of the proxy to retrieve
        
    Returns:
        Proxy data dictionary or None if not found
    """
    proxies = get_proxies()
    return next((proxy for proxy in proxies if proxy['id'] == proxy_id), None)


def create_proxy(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Create a new proxy
    
    Args:
        data: Proxy data dictionary
        
    Returns:
        New proxy dictionary
    """
    proxies = get_proxies()
    
    # Create a Proxy object
    proxy = Proxy(
        id=str(uuid.uuid4()),
        type=data.get('type', 'http'),
        host=data.get('host', ''),
        port=data.get('port', 0),
        username=data.get('username', ''),
        password=data.get('password', ''),
        status='untested',
        last_checked=None,
        accounts=[]
    )
    
    # Convert to dictionary and add to proxies list
    proxy_dict = proxy.to_dict()
    proxies.append(proxy_dict)
    
    # Save proxies
    save_proxies(proxies)
    
    return proxy_dict


def update_proxy(proxy_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Update an existing proxy
    
    Args:
        proxy_id: ID of the proxy to update
        data: New proxy data
        
    Returns:
        Updated proxy dictionary or None if not found
    """
    proxies = get_proxies()
    
    proxy_index = next((i for i, proxy in enumerate(proxies) if proxy['id'] == proxy_id), None)
    
    if proxy_index is None:
        return None
    
    # Update proxy fields
    proxy = Proxy.from_dict(proxies[proxy_index])
    proxy.update(data)
    
    # Update the proxies list
    proxies[proxy_index] = proxy.to_dict()
    save_proxies(proxies)
    
    return proxies[proxy_index]


def delete_proxy(proxy_id: str) -> bool:
    """
    Delete a proxy by ID and remove its association from any accounts
    
    Args:
        proxy_id: ID of the proxy to delete
        
    Returns:
        True if proxy was deleted, False if not found
    """
    proxies = get_proxies()
    accounts = get_accounts()
    
    initial_count = len(proxies)
    proxies = [proxy for proxy in proxies if proxy['id'] != proxy_id]
    
    if len(proxies) == initial_count:
        return False
    
    # Update accounts that were using this proxy
    for account in accounts:
        if account.get('proxy_id') == proxy_id:
            account['proxy_id'] = None
    
    save_proxies(proxies)
    save_accounts(accounts)
    
    return True


def test_multiple_proxies(proxy_ids: List[str]) -> List[Dict[str, Any]]:
    """
    Test multiple proxies in parallel
    
    Args:
        proxy_ids: List of proxy IDs to test
        
    Returns:
        List of test results for each proxy
    """
    proxies = get_proxies()
    results = []
    
    # Filter proxies by the provided IDs
    proxies_to_test = [proxy for proxy in proxies if proxy['id'] in proxy_ids]
    
    if not proxies_to_test:
        return []
    
    # Use a thread pool to test proxies in parallel
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as executor:
        future_to_proxy = {
            executor.submit(test_proxy, proxy): proxy['id'] 
            for proxy in proxies_to_test
        }
        
        for future in concurrent.futures.as_completed(future_to_proxy):
            proxy_id = future_to_proxy[future]
            try:
                result = future.result()
                # Add proxy_id to the result
                result['proxy_id'] = proxy_id
                results.append(result)
                
                # Update proxy status in the database
                proxy_index = next((i for i, p in enumerate(proxies) if p['id'] == proxy_id), None)
                if proxy_index is not None:
                    proxies[proxy_index]['status'] = 'online' if result['success'] else 'offline'
                    proxies[proxy_index]['last_checked'] = datetime.datetime.now().isoformat()
            except Exception as exc:
                results.append({
                    'proxy_id': proxy_id,
                    'success': False,
                    'error': str(exc)
                })
    
    # Save updated proxy statuses
    save_proxies(proxies)
    
    return results


def import_proxies_from_text(proxy_list: List[str]) -> Dict[str, int]:
    """
    Import proxies from a list of strings in various formats
    
    Args:
        proxy_list: List of proxy strings to import
        
    Returns:
        Dictionary with the number of imported proxies
    """
    proxies = get_proxies()
    imported_count = 0
    
    for proxy_item in proxy_list:
        # Make sure we're working with a string
        if isinstance(proxy_item, dict):
            # If we received a dict object, it might be a direct proxy definition
            try:
                # Create new proxy from the dict
                proxy = Proxy(
                    id=str(uuid.uuid4()),
                    type=proxy_item.get('type', 'http'),
                    host=proxy_item.get('host', ''),
                    port=proxy_item.get('port', 0),
                    username=proxy_item.get('username', ''),
                    password=proxy_item.get('password', ''),
                    status='untested',
                    last_checked=None,
                    accounts=[]
                )
                
                proxies.append(proxy.to_dict())
                imported_count += 1
                continue
            except Exception as e:
                logger.error(f"Error importing proxy from dict: {e}")
                continue
        
        # Normal string processing
        proxy_str = str(proxy_item).strip()
        if not proxy_str:
            continue
        
        # Parse the proxy string based on format
        proxy_data = parse_proxy_string(proxy_str)
        
        if proxy_data:
            # Check if proxy with same host/port already exists
            exists = any(
                p['host'] == proxy_data['host'] and 
                p['port'] == proxy_data['port'] and
                p['type'] == proxy_data['type']
                for p in proxies
            )
            
            if not exists:
                # Create new proxy
                proxy = Proxy(
                    id=str(uuid.uuid4()),
                    type=proxy_data['type'],
                    host=proxy_data['host'],
                    port=proxy_data['port'],
                    username=proxy_data.get('username', ''),
                    password=proxy_data.get('password', ''),
                    status='untested',
                    last_checked=None,
                    accounts=[]
                )
                
                proxies.append(proxy.to_dict())
                imported_count += 1
    
    if imported_count > 0:
        save_proxies(proxies)
    
    return {"imported_count": imported_count}


def parse_proxy_string(proxy_str: str) -> Optional[Dict[str, Any]]:
    """
    Parse a proxy string into its components
    
    Args:
        proxy_str: Proxy string in one of the supported formats
        
    Returns:
        Dictionary with proxy components or None if the format is invalid
    """
    parts = proxy_str.split(':')
    
    # Different formats handling
    if len(parts) == 2:
        # IP:Port format
        try:
            return {
                'type': 'http', # Default type
                'host': parts[0],
                'port': int(parts[1])
            }
        except (ValueError, IndexError):
            return None
    elif len(parts) == 3:
        # Type:IP:Port format
        if parts[0].lower() in ['http', 'https', 'socks5']:
            try:
                return {
                    'type': parts[0].lower(),
                    'host': parts[1],
                    'port': int(parts[2])
                }
            except (ValueError, IndexError):
                return None
        else:
            # Maybe it's IP:Port:Port format which isn't valid
            return None
    elif len(parts) == 4:
        # IP:Port:Username:Password format
        try:
            return {
                'type': 'http', # Default type
                'host': parts[0],
                'port': int(parts[1]),
                'username': parts[2],
                'password': parts[3]
            }
        except (ValueError, IndexError):
            return None
    elif len(parts) == 5:
        # Type:IP:Port:Username:Password format
        if parts[0].lower() in ['http', 'https', 'socks5']:
            try:
                return {
                    'type': parts[0].lower(),
                    'host': parts[1],
                    'port': int(parts[2]),
                    'username': parts[3],
                    'password': parts[4]
                }
            except (ValueError, IndexError):
                return None
    
    return None


def bulk_delete_proxies(proxy_ids: List[str]) -> Dict[str, int]:
    """
    Delete multiple proxies by their IDs and remove their associations from accounts
    
    Args:
        proxy_ids: List of proxy IDs to delete
        
    Returns:
        Dictionary with the number of deleted proxies
    """
    proxies = get_proxies()
    accounts = get_accounts()
    
    initial_count = len(proxies)
    proxies = [proxy for proxy in proxies if proxy['id'] not in proxy_ids]
    
    deleted_count = initial_count - len(proxies)
    
    # Update accounts that were using these proxies
    for account in accounts:
        if account.get('proxy_id') in proxy_ids:
            account['proxy_id'] = None
    
    if deleted_count > 0:
        save_proxies(proxies)
        save_accounts(accounts)
    
    return {"deleted_count": deleted_count}


def test_proxy(proxy_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Test a proxy connection by attempting to connect to a test URL
    
    Args:
        proxy_data: Proxy data dictionary
        
    Returns:
        Dictionary with test results
    """
    proxy_type = proxy_data.get('type', 'http')
    host = proxy_data.get('host', '')
    port = proxy_data.get('port', 0)
    username = proxy_data.get('username', '')
    password = proxy_data.get('password', '')
    
    # Construct proxy URL
    proxy_auth = f"{username}:{password}@" if username and password else ""
    proxy_url = f"{proxy_type}://{proxy_auth}{host}:{port}"
    
    proxies = {
        "http": proxy_url,
        "https": proxy_url
    }
    
    # Test connection
    start_time = time.time()
    
    try:
        # First, check if we can connect to the proxy server
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, int(port)))
        sock.close()
        
        if result != 0:
            return {
                "success": False,
                "error": f"Cannot connect to proxy server at {host}:{port}"
            }
        
        # Then try to make an HTTP request through the proxy
        response = requests.get(
            "https://httpbin.org/ip", 
            proxies=proxies, 
            timeout=10
        )
        
        if response.status_code != 200:
            return {
                "success": False,
                "error": f"Proxy returned HTTP status code {response.status_code}"
            }
        
        # Extract IP address from response
        data = response.json()
        ip_address = data.get('origin', 'Unknown')
        
        # Calculate response time
        end_time = time.time()
        response_time = int((end_time - start_time) * 1000)  # Convert to milliseconds
        
        # Try to get location information
        try:
            location_response = requests.get(
                f"https://ipinfo.io/{ip_address}/json",
                timeout=5
            )
            if location_response.status_code == 200:
                location_data = location_response.json()
                location = f"{location_data.get('city', '')}, {location_data.get('country', '')}"
                location = location.strip(", ")
            else:
                location = "Unknown"
        except Exception:
            location = "Unknown"
        
        return {
            "success": True,
            "ip_address": ip_address,
            "response_time": response_time,
            "location": location
        }
        
    except requests.exceptions.ProxyError:
        return {
            "success": False,
            "error": "Invalid proxy configuration or proxy server rejected connection"
        }
    except requests.exceptions.ConnectTimeout:
        return {
            "success": False,
            "error": "Connection to proxy timed out"
        }
    except requests.exceptions.ReadTimeout:
        return {
            "success": False,
            "error": "Request through proxy timed out"
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }