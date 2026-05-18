"""Simple test to improve coverage."""


def test_cognizes_module_import():
    """Test that cognizes module can be imported."""
    # This will cover the cognizes/__init__.py file
    import cognizes

    # Access the version to ensure it's loaded
    assert hasattr(cognizes, "__version__")
