import uuid
import datetime
from typing import Dict, List, Optional, Any, Union


class Account:
    """Account model representing a Telegram account"""
    
    def __init__(
        self,
        id: Optional[str] = None,
        phone: str = "",
        name: str = "",
        username: str = "",
        avatar: str = "",
        status: str = "Не проверен",
        limits: Optional[Dict[str, int]] = None,
        list_ids: Optional[List[str]] = None,
        list_id: Optional[str] = None,
        cooldown_until: Optional[str] = None,
        premium: bool = False,
        created_at: Optional[str] = None
    ):
        self.id = id or str(uuid.uuid4())
        self.phone = phone
        self.name = name
        self.username = username
        self.avatar = avatar or f"https://ui-avatars.com/api/?name={name}&background=random"
        self.status = status
        self.limits = limits or {"daily_invites": 30, "daily_messages": 50}
        
        # Handle both list_ids (array) and list_id (string) for backwards compatibility
        self.list_ids = list_ids or []
        if list_id and list_id not in self.list_ids:
            self.list_ids.append(list_id)
        if not self.list_ids:
            self.list_ids = ["main"]
        
        self.list_id = list_id or self.list_ids[0]  # Backward compatibility
        self.cooldown_until = cooldown_until
        self.premium = premium
        self.created_at = created_at or datetime.datetime.now().isoformat()
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Account':
        """Create an Account instance from a dictionary"""
        return cls(
            id=data.get('id'),
            phone=data.get('phone', ''),
            name=data.get('name', ''),
            username=data.get('username', ''),
            avatar=data.get('avatar', ''),
            status=data.get('status', 'Не проверен'),
            limits=data.get('limits', {"daily_invites": 30, "daily_messages": 50}),
            list_ids=data.get('list_ids', []),
            list_id=data.get('list_id'),
            cooldown_until=data.get('cooldown_until'),
            premium=data.get('premium', False),
            created_at=data.get('created_at')
        )
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert the Account instance to a dictionary"""
        return {
            'id': self.id,
            'phone': self.phone,
            'name': self.name,
            'username': self.username,
            'avatar': self.avatar,
            'status': self.status,
            'limits': self.limits,
            'list_ids': self.list_ids,
            'list_id': self.list_id,
            'cooldown_until': self.cooldown_until,
            'premium': self.premium,
            'created_at': self.created_at
        }
    
    def update(self, data: Dict[str, Any]) -> None:
        """Update account with new data"""
        for key, value in data.items():
            if key != 'id':  # Don't allow ID to be changed
                setattr(self, key, value)
                
        # Handle list_ids updates
        if 'list_id' in data and data['list_id']:
            if 'list_ids' not in data or not data['list_ids']:
                # Update list_ids based on list_id for backward compatibility
                if data['list_id'] not in self.list_ids:
                    self.list_ids.append(data['list_id'])
            self.list_id = data['list_id']