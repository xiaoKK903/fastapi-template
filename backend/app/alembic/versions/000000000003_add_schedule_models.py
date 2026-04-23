"""Add schedule models

Revision ID: 000000000003
Revises: 000000000002
Create Date: 2026-04-23 10:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision = '000000000003'
down_revision = '000000000002'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'schedule',
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=2000), nullable=True),
        sa.Column('start_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('end_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('is_recurring', sa.Boolean(), nullable=False),
        sa.Column('recurring_type', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('recurring_interval', sa.Integer(), nullable=True),
        sa.Column('recurring_end_date', sa.Date(), nullable=True),
        sa.Column('reminder_minutes', sa.Integer(), nullable=True),
        sa.Column('is_all_day', sa.Boolean(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_schedule_category'), 'schedule', ['category'], unique=False)
    op.create_index(op.f('ix_schedule_is_deleted'), 'schedule', ['is_deleted'], unique=False)
    op.create_index(op.f('ix_schedule_title'), 'schedule', ['title'], unique=False)
    
    op.create_table(
        'schedulereminder',
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('schedule_id', sa.Uuid(), nullable=False),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.Column('reminder_time', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_sent', sa.Boolean(), nullable=False),
        sa.Column('sent_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['schedule_id'], ['schedule.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_schedulereminder_is_sent'), 'schedulereminder', ['is_sent'], unique=False)


def downgrade():
    op.drop_index(op.f('ix_schedulereminder_is_sent'), table_name='schedulereminder')
    op.drop_table('schedulereminder')
    op.drop_index(op.f('ix_schedule_title'), table_name='schedule')
    op.drop_index(op.f('ix_schedule_is_deleted'), table_name='schedule')
    op.drop_index(op.f('ix_schedule_category'), table_name='schedule')
    op.drop_table('schedule')
