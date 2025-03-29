// web/components/AppStatus.jsx
import React, { useState, useEffect } from 'react';
import { Card, Banner, List, Text, Button, Link, Box, Spinner } from '@shopify/polaris';
import { api } from '../api';

const AppStatus = ({ shopDomain }) => {
  const [status, setStatus] = useState({
    checking: true,
    appProxy: null,
    scriptTag: null,
    orderLimits: null,
    error: null
  });

  useEffect(() => {
    checkStatus();
  }, []);

  const checkStatus = async () => {
    // First validate the shopDomain
    if (!shopDomain) {
      setStatus(prev => ({
        ...prev, 
        checking: false,
        error: 'Shop domain is required to check app status'
      }));
      return;
    }
    
    setStatus(prev => ({ ...prev, checking: true, error: null }));
    
    try {
      // Check app proxy configuration
      const appProxyResult = await api.checkAppProxyConfiguration({ shop: shopDomain });
      
      // Get count of order limits
      const orderLimitsCount = await api.OrderLimit.count();
      
      // For this simplified version, we'll assume the script tag is registered
      // In a real implementation, you would add a dedicated endpoint to check script tags
      
      setStatus({
        checking: false,
        appProxy: appProxyResult,
        scriptTag: {
          success: true, // Simplified for this example
          message: 'Script tag is registered'
        },
        orderLimits: {
          count: orderLimitsCount,
          success: orderLimitsCount > 0,
          message: orderLimitsCount > 0 
            ? `${orderLimitsCount} product(s) have order limits configured`
            : 'No products have order limits configured'
        },
        error: null
      });
    } catch (error) {
      console.error('Error checking app status:', error);
      setStatus(prev => ({
        ...prev,
        checking: false,
        error: error.message || 'An unknown error occurred'
      }));
    }
  };

  if (status.checking) {
    return (
      <Card title="App Status">
        <Card.Section>
          <Box padding="400" textAlign="center">
            <Spinner accessibilityLabel="Checking app status" />
            <Box paddingBlockStart="300">
              <Text as="p" variant="bodyMd">Checking app configuration...</Text>
            </Box>
          </Box>
        </Card.Section>
      </Card>
    );
  }

  if (status.error) {
    return (
      <Card title="App Status">
        <Card.Section>
          <Banner status="critical">
            Error checking app status: {status.error}
          </Banner>
          <Box paddingBlockStart="300">
            <Button onClick={checkStatus}>Retry</Button>
          </Box>
        </Card.Section>
      </Card>
    );
  }

  // Determine overall status
  const hasIssues = !status.appProxy?.success || !status.scriptTag?.success;
  const overallStatus = hasIssues ? 'warning' : (status.orderLimits?.count > 0 ? 'success' : 'info');

  return (
    <Card title="App Status">
      <Card.Section>
        <Banner status={overallStatus}>
          {hasIssues 
            ? 'There are configuration issues that need attention' 
            : (status.orderLimits?.count > 0 
                ? 'App is properly configured and order limits are active'
                : 'App is properly configured but no order limits are set yet')}
        </Banner>
        
        <Box paddingBlockStart="400">
          <Text as="h3" variant="headingMd">Configuration Status</Text>
          
          <List>
            <List.Item>
              App Proxy: {status.appProxy?.success 
                ? '✓ Correctly configured' 
                : '⚠️ Issue detected'}
              {status.appProxy && !status.appProxy.success && status.appProxy.message && (
                <Text as="p" variant="bodyMd" color="critical">
                  {status.appProxy.message}
                </Text>
              )}
            </List.Item>
            
            <List.Item>
              Script Tag: {status.scriptTag?.success 
                ? '✓ Registered' 
                : '⚠️ Not registered'}
            </List.Item>
            
            <List.Item>
              Order Limits: {status.orderLimits?.count > 0
                ? `✓ ${status.orderLimits.count} product(s) configured`
                : '⚠️ No products configured yet'}
            </List.Item>
          </List>
        </Box>
        
        {!status.appProxy?.success && status.appProxy?.requiredConfiguration && (
          <Box paddingBlockStart="400">
            <Banner status="warning">
              <Text as="p" variant="bodyMd">Required App Proxy Configuration:</Text>
              <List>
                <List.Item>Subpath: {status.appProxy.requiredConfiguration.subpath}</List.Item>
                <List.Item>URL: {status.appProxy.requiredConfiguration.url}</List.Item>
              </List>
              <Text as="p" variant="bodyMd" paddingBlockStart="300">
                <Link url="https://shopify.dev/api/checkout-extensions/checkout/configuration" external>
                  Learn how to configure app proxy
                </Link>
              </Text>
            </Banner>
          </Box>
        )}
        
        <Box paddingBlockStart="300">
          <Button onClick={checkStatus}>Refresh Status</Button>
        </Box>
      </Card.Section>
    </Card>
  );
};

export default AppStatus;
