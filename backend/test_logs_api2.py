import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlmodel import Session, select
from app.core.db import engine
from app.models import User, OperationLog

print("=" * 60)
print("检查错误日志")
print("=" * 60)

with Session(engine) as session:
    print("\n1. 检查失败的请求日志 (success=False):")
    failed_logs = session.exec(
        select(OperationLog)
        .where(OperationLog.success == False)
        .order_by(OperationLog.created_at.desc())
        .limit(20)
    ).all()
    
    print(f"   失败日志数量: {len(failed_logs)}")
    for log in failed_logs:
        print(f"\n   - 时间: {log.created_at}")
        print(f"     用户: {log.user_email}")
        print(f"     请求: {log.request_method} {log.request_path}")
        print(f"     状态码: {log.response_status}")
        print(f"     耗时: {log.duration_ms}ms")
        if log.error_message:
            print(f"     错误: {log.error_message}")

    print("\n2. 检查包含 'operation-logs' 的请求:")
    logs_with_op = session.exec(
        select(OperationLog)
        .where(OperationLog.request_path.like("%operation-logs%"))
        .order_by(OperationLog.created_at.desc())
        .limit(20)
    ).all()
    
    print(f"   相关日志数量: {len(logs_with_op)}")
    for log in logs_with_op:
        print(f"\n   - 时间: {log.created_at}")
        print(f"     用户: {log.user_email}")
        print(f"     请求: {log.request_method} {log.request_path}")
        print(f"     状态码: {log.response_status}")
        print(f"     成功: {log.success}")
        if log.error_message:
            print(f"     错误: {log.error_message}")

    print("\n3. 检查 403 状态码的请求:")
    logs_403 = session.exec(
        select(OperationLog)
        .where(OperationLog.response_status == 403)
        .order_by(OperationLog.created_at.desc())
        .limit(20)
    ).all()
    
    print(f"   403 日志数量: {len(logs_403)}")
    for log in logs_403:
        print(f"\n   - 时间: {log.created_at}")
        print(f"     用户: {log.user_email}")
        print(f"     请求: {log.request_method} {log.request_path}")
        print(f"     状态码: {log.response_status}")

print("\n" + "=" * 60)
print("测试完成")
print("=" * 60)
