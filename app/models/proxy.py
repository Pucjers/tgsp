import uuid
import datetime
from typing import Dict, Any, Optional, List, Union


class Proxy:
    """Proxy model representing a proxy server configuration"""
    
    def __init__(
        self,
        id: Optional[str] = None,
        type: str = "http",
        host: str = "",
        port: int = 0,
        username: str = "",
        password: str = "",
        status: str = "untested",
        last_checked: Optional[str] = None,
        accounts: Optional[List[str]] = None
    ):
        self.id = id or str(uuid.uuid4())
        self.type = type
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.status = status
        self.last_checked = last_checked
        self.accounts = accounts or []  # List of account IDs using this proxy
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Proxy':
        """Create a Proxy instance from a dictionary"""
        return cls(
            id=data.get('id'),
            type=data.get('type', 'http'),
            host=data.get('host', ''),
            port=data.get('port', 0),
            username=data.get('username', ''),
            password=data.get('password', ''),
            status=data.get('status', 'untested'),
            last_checked=data.get('last_checked'),
            accounts=data.get('accounts', [])
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the Proxy instance to a dictionary"""
        return {
            'id': self.id,
            'type': self.type,
            'host': self.host,
            'port': self.port,
            'username': self.username,
            'password': self.password,
            'status': self.status,
            'last_checked': self.last_checked,
            'accounts': self.accounts
        }
    
    def update(self, data: Dict[str, Any]) -> None:
        """Update proxy with new data"""
        for key, value in data.items():
            if key != 'id':  # Don't allow ID to be changed
                setattr(self, key, value)
                
    def can_add_account(self) -> bool:
        """Check if a new account can be added to this proxy"""
        return len(self.accounts) < 3  # Maximum 3 accounts per proxy
    
    def add_account(self, account_id: str) -> bool:
        """Add an account to this proxy"""
        if not self.can_add_account():
            return False
            
        if account_id not in self.accounts:
            self.accounts.append(account_id)
            return True
            
        return False  # Account already associated with this proxy
    
    def remove_account(self, account_id: str) -> bool:
        """Remove an account from this proxy"""
        if account_id in self.accounts:
            self.accounts.remove(account_id)
            return True
            
        return False  # Account not associated with this proxy