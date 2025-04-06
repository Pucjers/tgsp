from typing import Dict, Any, List

from app.api.accounts.services import get_filtered_accounts


def get_account_statistics(list_id: str = 'all') -> Dict[str, int]:
    """
    Get statistics about accounts, optionally filtered by list_id
    
    Args:
        list_id: The list ID to filter by, or 'all' for all accounts
        
    Returns:
        Dictionary with account statistics
    """
    accounts = get_filtered_accounts(list_id)
    
    stats = {
        "all": len(accounts),
        "ok": len([acc for acc in accounts if acc.get('status') == "Ок"]),
        "blocked": len([acc for acc in accounts if acc.get('status') == "Заблокирован"]),
        "unauth": len([acc for acc in accounts if acc.get('status') == "Не авторизован"]),
        "error": len([acc for acc in accounts if acc.get('status') == "Ошибка проверки"]),
        "temp_block": len([acc for acc in accounts if acc.get('status') == "Временный блок"]),
        "premium": len([acc for acc in accounts if acc.get('premium')]),
    }
    
    return stats