import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from app.core.db import engine
from app.models import User, OperationLog
from app.core import security
from app.core.config import settings
from datetime import datetime, timedelta, timezone

print("=" * 60)
print("测试日志接口")
print("=" * 60)

with Session(engine) as session:
    print("\n1. 检查用户 'aaawhz@ddde11.com':")
    user = session.exec(select(User).where(User.email == "aaawhz@ddde11.com")).first()
    if user:
        print(f"   用户存在: {user.email}")
        print(f"   用户ID: {user.id}")
        print(f"   is_superuser: {user.is_superuser}")
    else:
        print("   用户不存在!")

    print("\n2. 检查超级用户:")
    superusers = session.exec(select(User).where(User.is_superuser == True)).all()
    print(f"   超级用户数量: {len(superusers)}")
    for su in superusers:
        print(f"   - {su.email} (is_superuser={su.is_superuser})")

    print("\n3. 检查 OperationLog 表是否有数据:")
    log_count = session.exec(select(OperationLog.id)).all()
    print(f"   日志数量: {len(log_count)}")

    print("\n4. 最近 10 条日志:")
    recent_logs = session.exec(
        select(OperationLog).order_by(OperationLog.created_at.desc()).limit(10)
    ).all()
    for log in recent_logs:
        print(f"   - [{log.created_at}] {log.request_method} {log.request_path} -> {log.response_status} (user={log.user_email})")
        if log.error_message:
            print(f"     错误: {log.error_message}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
