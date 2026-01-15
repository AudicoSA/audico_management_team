
import pytest
from unittest.mock import AsyncMock, Mock, patch, MagicMock
from src.agents.stock_agent import StockListingsAgent, ProductData

class TestStockListingsAgent:
    
    @pytest.fixture
    def mock_opencart_connector(self):
        mock = Mock()
        mock.get_product_by_sku = AsyncMock()
        mock.get_product_by_model = AsyncMock()
        mock.search_products_by_name = AsyncMock()
        mock.create_product = AsyncMock()
        return mock

    @pytest.fixture
    def agent(self, mock_supabase_connector, mock_opencart_connector):
        with patch('src.agents.stock_agent.get_config'), \
             patch('src.agents.stock_agent.OpenAI'):
            # Mock the client attribute on supabase connector since the agent accesses it directly
            mock_supabase_connector.client = MagicMock()
            return StockListingsAgent(mock_supabase_connector, mock_opencart_connector)

    @pytest.mark.asyncio
    async def test_process_discontinued_products_none(self, agent, mock_supabase_connector):
        """Test case where no products are discontinued."""
        # Setup Mock DB Response for existing SKUs
        # Chain: table() -> select() -> eq() -> execute() -> data
        mock_execute = MagicMock()
        mock_execute.data = [{'sku': 'SKU1'}, {'sku': 'SKU2'}]
        
        mock_eq = MagicMock()
        mock_eq.execute.return_value = mock_execute
        
        mock_select = MagicMock()
        mock_select.eq.return_value = mock_eq
        
        mock_table = MagicMock()
        mock_table.select.return_value = mock_select
        
        agent.supabase.client.table.return_value = mock_table
        
        # Extracted SKUs match DB
        extracted = {'SKU1', 'SKU2'}
        
        count = await agent._process_discontinued_products('SupplierA', extracted, [])
        assert count == 0

    @pytest.mark.asyncio
    async def test_process_discontinued_products_some(self, agent, mock_supabase_connector):
        """Test case where some products are discontinued."""
        # Setup Mock DB Response: SKU1, SKU2, SKU3 exist
        mock_execute = MagicMock()
        mock_execute.data = [{'sku': 'SKU1'}, {'sku': 'SKU2'}, {'sku': 'SKU3'}]
        
        mock_eq = MagicMock()
        mock_eq.execute.return_value = mock_execute
        
        mock_select = MagicMock()
        mock_select.eq.return_value = mock_eq
        
        mock_table = MagicMock()
        mock_table.select.return_value = mock_select
        
        agent.supabase.client.table.return_value = mock_table
        
        # Extracted SKUs missing SKU3
        extracted = {'SKU1', 'SKU2'}
        
        count = await agent._process_discontinued_products('SupplierA', extracted, [])
        assert count == 1

    @pytest.mark.asyncio
    async def test_calculate_retail_price_default(self, agent):
        """Test retail price calculation with default markup."""
        # Mock get_pricing_rule to return None
        agent.get_pricing_rule = AsyncMock(return_value=None)
        
        # Default markup is 30% -> 100 * 1.3 = 130
        price = await agent.calculate_retail_price(100.0, "supp_123")
        assert price == 130.0

    @pytest.mark.asyncio
    async def test_calculate_retail_price_custom_rule(self, agent):
        """Test retail price calculation with custom rule."""
        # Mock get_pricing_rule
        agent.get_pricing_rule = AsyncMock(return_value={
            'pricing_type': 'cost',
            'default_markup_pct': 50.0
        })
        
        # 50% markup -> 100 * 1.5 = 150
        price = await agent.calculate_retail_price(100.0, "supp_123")
        assert price == 150.0

    @pytest.mark.asyncio
    async def test_calculate_retail_price_retail_type(self, agent):
        """Test retail price calculation when pricing_type is retail."""
        # Mock get_pricing_rule
        agent.get_pricing_rule = AsyncMock(return_value={
            'pricing_type': 'retail'
        })
        
        # Should return cost as-is
        price = await agent.calculate_retail_price(100.0, "supp_123")
        assert price == 100.0
