import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useConnection } from '../providers/ConnectionProvider';
import { ConnectionBar } from '../components/ConnectionBar';
import { ConnectionScreen } from '../screens/ConnectionScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { BatchListScreen } from '../screens/gallery/BatchListScreen';
import { BatchDetailScreen } from '../screens/gallery/BatchDetailScreen';
import { ImageViewerScreen } from '../screens/gallery/ImageViewerScreen';
import { SettingsScreen } from '../screens/settings/SettingsScreen';
import { NetworkScreen } from '../screens/settings/NetworkScreen';
import { colors, PIXEL_FONT } from '../theme';
import { VideoCamera, SquaresFour, GearSix } from 'phosphor-react-native';

const Tab = createBottomTabNavigator();
const GalleryStack = createNativeStackNavigator();
const SettingsStack = createNativeStackNavigator();
const RootStack = createNativeStackNavigator();

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

function SettingsStackScreen() {
  return (
    <SettingsStack.Navigator screenOptions={{ headerShown: false }}>
      <SettingsStack.Screen name="SettingsMain" component={SettingsScreen} />
      <SettingsStack.Screen name="Network" component={NetworkScreen} />
    </SettingsStack.Navigator>
  );
}

function MainTabs() {
  return (
    <>
      <ConnectionBar />
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarStyle: {
            backgroundColor: colors.background,
            borderTopColor: colors.border,
            borderTopWidth: 1,
            paddingTop: 4,
          },
          tabBarActiveTintColor: colors.text,
          tabBarInactiveTintColor: colors.textDim,
          tabBarLabelStyle: {
            fontFamily: PIXEL_FONT,
            fontSize: 9,
            letterSpacing: 1,
            textTransform: 'uppercase',
          },
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <VideoCamera size={size} color={color} weight="duotone" />
            ),
          }}
        />
        <Tab.Screen
          name="Gallery"
          component={GalleryStackScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <SquaresFour size={size} color={color} weight="duotone" />
            ),
          }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsStackScreen}
          options={{
            tabBarIcon: ({ color, size }) => (
              <GearSix size={size} color={color} weight="duotone" />
            ),
          }}
        />
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
