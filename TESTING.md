# Testing Guide

Comprehensive testing documentation for the Audico AI system.

## Test Structure

```
tests/
├── __init__.py
├── conftest.py              # Pytest fixtures and configuration
├── test_email_agent.py      # Email agent tests
├── test_connectors.py       # Gmail, Supabase, OpenCart tests
└── test_api.py              # FastAPI endpoint tests
```

## Running Tests

### Quick Start

```bash
# Windows
RUN_TESTS.bat

# Linux/Mac
pytest tests/ -v
```

### With Coverage

```bash
pytest tests/ -v --cov=src --cov-report=html --cov-report=term
```

View coverage report: Open `htmlcov/index.html` in browser

### Specific Test Files

```bash
# Test only email agent
pytest tests/test_email_agent.py -v

# Test only connectors
pytest tests/test_connectors.py -v

# Test only API endpoints
pytest tests/test_api.py -v
```

### Run Specific Tests

```bash
# Run specific test method
pytest tests/test_email_agent.py::TestEmailManagementAgent::test_process_email_success -v

# Run tests matching pattern
pytest tests/ -k "email" -v
```

## Test Categories

### Unit Tests

Test individual components in isolation with mocked dependencies.

**Examples:**
- `test_extract_order_numbers`: Tests order number regex extraction
- `test_classify_email`: Tests LLM classification logic
- `test_create_draft`: Tests Gmail draft creation

**Run only unit tests:**
```bash
pytest tests/ -v -m "not integration"
```

### Integration Tests

Test components working together with real external services.

**Mark integration tests with:**
```python
@pytest.mark.integration
async def test_real_supabase_connection():
    # Test with real Supabase instance
    pass
```

**Run integration tests:**
```bash
pytest tests/ -v -m integration
```

⚠️ **Note**: Integration tests require:
- Valid `.env` file with credentials
- Access to Supabase staging database
- Gmail API test account

### Async Tests

All async tests use `pytest-asyncio`:

```python
@pytest.mark.asyncio
async def test_async_function():
    result = await some_async_function()
    assert result is not None
```

## Writing Tests

### Test Email Processing

```python
@pytest.mark.asyncio
async def test_process_email_success(sample_email, mock_gmail_connector, mock_supabase_connector):
    """Test successful email processing."""
    with patch('src.agents.email_agent.get_gmail_connector', return_value=mock_gmail_connector):
        agent = EmailManagementAgent()
        result = await agent.process_email("test_message_123")

        assert result["status"] == "success"
        assert result["category"] == "ORDER_STATUS_QUERY"
```

### Test API Endpoints

```python
def test_health_check(client):
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
```

### Using Fixtures

Fixtures are defined in `conftest.py`:

```python
def test_with_sample_email(sample_email):
    """Use the sample_email fixture."""
    assert sample_email.from_email == "customer@example.com"
```

## Mocking External Services

### Mock Gmail

```python
mock_gmail = Mock(spec=GmailConnector)
mock_gmail.list_unread_messages = Mock(return_value=["msg1", "msg2"])
mock_gmail.get_message = Mock(return_value=sample_email)
```

### Mock Supabase

```python
mock_supabase = Mock(spec=SupabaseConnector)
mock_supabase.create_email_log = AsyncMock(return_value="log_uuid")
mock_supabase.check_email_already_processed = AsyncMock(return_value=False)
```

### Mock LLM

```python
with patch('src.models.llm_client.get_openai_client') as mock_client:
    mock_response = Mock()
    mock_response.choices[0].message.content = '{"category": "ORDER_STATUS_QUERY"}'
    mock_client.return_value.chat.completions.create = AsyncMock(return_value=mock_response)
```

## Code Coverage Goals

Target coverage levels:

- **Overall**: > 80%
- **Critical paths**: > 90% (email processing, classification, drafting)
- **Connectors**: > 75%
- **API endpoints**: > 85%

Check current coverage:
```bash
pytest tests/ --cov=src --cov-report=term-missing
```

## Test Data

### Sample Emails

Use the `sample_email` fixture for consistent test data:

```python
def test_something(sample_email):
    assert sample_email.subject == "Where is my order #12345?"
```

### Custom Test Data

```python
custom_email = ParsedEmail(
    message_id="custom_123",
    from_email="test@example.com",
    subject="Custom subject",
    body="Custom body",
    # ... other fields
)
```

## Continuous Integration

### GitHub Actions Workflow

Create `.github/workflows/test.yml`:

```yaml
name: Tests

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-python@v4
        with:
          python-version: '3.11'
      - run: pip install -r requirements.txt -r requirements-dev.txt
      - run: pytest tests/ -v --cov=src --cov-report=xml
      - uses: codecov/codecov-action@v3
```

## Troubleshooting

### Tests Fail Locally

1. **Ensure virtual environment is activated**:
   ```bash
   venv\Scripts\activate  # Windows
   source venv/bin/activate  # Linux/Mac
   ```

2. **Install dev dependencies**:
   ```bash
   pip install -r requirements-dev.txt
   ```

3. **Clear pytest cache**:
   ```bash
   pytest --cache-clear
   ```

### Import Errors

Ensure `src/` is in Python path:
```bash
# Add to pytest.ini or run with:
PYTHONPATH=. pytest tests/
```

### Async Test Warnings

If you see `RuntimeWarning: coroutine was never awaited`, ensure:
- Test is marked with `@pytest.mark.asyncio`
- Function is defined as `async def`
- Mocked async functions use `AsyncMock`

### Mock Not Working

Verify patch target path is correct:
```python
# Correct - patch where it's imported
with patch('src.agents.email_agent.get_gmail_connector'):
    pass

# Wrong - patch original location
with patch('src.connectors.gmail.get_gmail_connector'):
    pass
```

## Best Practices

1. **Test One Thing**: Each test should verify one specific behavior
2. **Descriptive Names**: Use clear test names like `test_email_already_processed_is_skipped`
3. **Arrange-Act-Assert**: Structure tests clearly:
   ```python
   # Arrange
   mock_data = {...}

   # Act
   result = function_under_test(mock_data)

   # Assert
   assert result == expected
   ```
4. **Use Fixtures**: Don't repeat setup code
5. **Mock External Dependencies**: Tests should not call real APIs
6. **Test Error Cases**: Don't just test happy paths
7. **Keep Tests Fast**: Mock external services, use in-memory databases

## Running Tests in CI/CD

Tests automatically run on:
- Every push to repository
- Every pull request
- Before deployment to staging/production

Deployment is blocked if tests fail.

## Next Steps

- [ ] Add integration tests with Supabase staging
- [ ] Add end-to-end tests for email workflow
- [ ] Set up GitHub Actions for automated testing
- [ ] Configure code coverage reporting (Codecov)
- [ ] Add performance tests for high-volume scenarios
