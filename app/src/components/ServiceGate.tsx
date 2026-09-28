import React from 'react';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '@/context/AuthContext';
import { Screen, EmptyState } from '@/components/ui/Screen';
import { ROUTE_SERVICE, SERVICE_LABELS, isRouteEnabled } from '@/constants/services';

const Blocked: React.FC<{ route: string }> = ({ route }) => {
  const navigation = useNavigation<any>();
  return (
    <Screen>
      <EmptyState
        icon="lock-outline"
        title={`${SERVICE_LABELS[ROUTE_SERVICE[route]]} is not enabled`}
        subtitle="This service isn't switched on for your account. Please contact your distributor to enable it."
        action={{ label: 'Back to home', onPress: () => navigation.navigate('Dashboard') }}
      />
    </Screen>
  );
};

/**
 * Wraps a service screen so it renders only while the service is on. Hidden
 * menu entries are not enough: notifications and deep links still navigate.
 */
export const withServiceGate = (route: string, Component: React.ComponentType<any>) => {
  if (!ROUTE_SERVICE[route]) return Component;
  const Gated = (props: any) => {
    const { user } = useAuth();
    return isRouteEnabled(user, route) ? <Component {...props} /> : <Blocked route={route} />;
  };
  Gated.displayName = `ServiceGate(${route})`;
  return Gated;
};
