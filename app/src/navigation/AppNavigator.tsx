import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { useConnection } from '../providers/ConnectionProvider';
import { ConnectionBar } from '../components/ConnectionBar';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PreviewScreen } from '../screens/PreviewScreen';
import { BatchListScreen } from '../screens/gallery/BatchListScreen';
import { BatchDetailScreen } from '../screens/gallery/BatchDetailScreen';
import { ImageViewerScreen } from '../screens/gallery/ImageViewerScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { colors } from '../theme';

const Tab = createBottomTabNavigator();
const GalleryStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

function TabIcon({ label, focused }: { label: string; focused: boolean }) {
  const icons: Record<string, string> = { Dashboard: '📊', Preview: '📷', Gallery: '🖼️', Settings: '⚙️' };
  return <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.5 }}>{icons[label] || '•'}</Text>;
}

function GalleryStackScreen() {
  return (
    <GalleryStack.Navigator screenOptions={{ headerShown: false }}>
      <GalleryStack.Screen name="BatchList" component={BatchListScreen} />
      <GalleryStack.Screen name="BatchDetail" component={BatchDetailScreen} />
      <GalleryStack.Screen
        name="ImageViewer"
        component={ImageViewerScreen}
        options={{ presentation: 'fullScreenModal', animation: 'fade' }}
      />
    </GalleryStack.Navigator>
  );
}

function MainTabs() {
  return (
    <>
      <ConnectionBar />
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarIcon: ({ focused }) => <TabIcon label={route.name} focused={focused} />,
          tabBarStyle: { backgroundColor: colors.background, borderTopColor: colors.surfaceLight },
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.textMuted,
        })}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} />
        <Tab.Screen name="Preview" component={PreviewScreen} />
        <Tab.Screen name="Gallery" component={GalleryStackScreen} />
        <Tab.Screen name="Settings" component={SettingsScreen} />
      </Tab.Navigator>
    </>
  );
}

export function AppNavigator() {
  const { state } = useConnection();

  if (state !== 'connected') {
    return <ConnectionScreen />;
  }

  return (
    <RootStack.Navigator screenOptions={{ headerShown: false }}>
      <RootStack.Screen name="Main" component={MainTabs} />
    </RootStack.Navigator>
  );
}
