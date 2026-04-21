from sqlmodel import Session, select
from app.core.db import engine
from app.models import User, Role, UserRoleLink

with Session(engine) as session:
    print('Users:')
    users = session.exec(select(User)).all()
    for u in users:
        print(f'  {u.email} (superuser: {u.is_superuser})')
    
    print('\nRoles:')
    roles = session.exec(select(Role)).all()
    for r in roles:
        print(f'  {r.code}: {r.name}')
    
    print('\nUser-Role Links:')
    links = session.exec(select(UserRoleLink)).all()
    for l in links:
        print(f'  User {l.user_id} -> Role {l.role_id}')
    
    # Check specific user roles
    if users:
        user = users[0]
        print(f'\nRoles for {user.email}:')
        user_roles = session.exec(
            select(Role)
            .join(UserRoleLink)
            .where(UserRoleLink.user_id == user.id)
        ).all()
        for r in user_roles:
            print(f'  - {r.code}: {r.name}')
        if not user_roles:
            print('  No roles assigned!')
