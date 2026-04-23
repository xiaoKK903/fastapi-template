"""Add article models

Revision ID: 000000000002
Revises: 000000000001
Create Date: 2026-04-20 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
import sqlmodel.sql.sqltypes


revision = '000000000002'
down_revision = '000000000001'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'articlecategory',
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=100), nullable=False),
        sa.Column('description', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column('icon', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=True),
        sa.Column('parent_id', sa.Uuid(), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['parent_id'], ['articlecategory.id'], ),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_articlecategory_name'), 'articlecategory', ['name'], unique=False)
    
    op.create_table(
        'articletag',
        sa.Column('name', sqlmodel.sql.sqltypes.AutoString(length=50), nullable=False),
        sa.Column('color', sqlmodel.sql.sqltypes.AutoString(length=20), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_articletag_name'), 'articletag', ['name'], unique=False)
    
    op.create_table(
        'article',
        sa.Column('title', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=False),
        sa.Column('summary', sqlmodel.sql.sqltypes.AutoString(length=1000), nullable=True),
        sa.Column('content', sa.Text(), nullable=True),
        sa.Column('cover_image', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('status', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('category_id', sa.Uuid(), nullable=True),
        sa.Column('views', sa.Integer(), nullable=False),
        sa.Column('word_count', sa.Integer(), nullable=False),
        sa.Column('is_deleted', sa.Boolean(), nullable=False),
        sa.Column('is_private', sa.Boolean(), nullable=False),
        sa.Column('sensitive_level', sqlmodel.sql.sqltypes.AutoString(), nullable=False),
        sa.Column('sensitive_reason', sqlmodel.sql.sqltypes.AutoString(length=500), nullable=True),
        sa.Column('id', sa.Uuid(), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('published_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('owner_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['category_id'], ['articlecategory.id'], ),
        sa.ForeignKeyConstraint(['owner_id'], ['user.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index(op.f('ix_article_title'), 'article', ['title'], unique=False)
    op.create_index(op.f('ix_article_status'), 'article', ['status'], unique=False)
    op.create_index(op.f('ix_article_is_deleted'), 'article', ['is_deleted'], unique=False)
    
    op.create_table(
        'articletaglink',
        sa.Column('article_id', sa.Uuid(), nullable=False),
        sa.Column('tag_id', sa.Uuid(), nullable=False),
        sa.ForeignKeyConstraint(['article_id'], ['article.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['tag_id'], ['articletag.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('article_id', 'tag_id'),
    )


def downgrade():
    op.drop_table('articletaglink')
    op.drop_index(op.f('ix_article_is_deleted'), table_name='article')
    op.drop_index(op.f('ix_article_status'), table_name='article')
    op.drop_index(op.f('ix_article_title'), table_name='article')
    op.drop_table('article')
    op.drop_index(op.f('ix_articletag_name'), table_name='articletag')
    op.drop_table('articletag')
    op.drop_index(op.f('ix_articlecategory_name'), table_name='articlecategory')
    op.drop_table('articlecategory')
