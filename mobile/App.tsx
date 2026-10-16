import React, { useState, useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import * as Linking from "expo-linking";
import { Platform } from "react-native";
import { mobileApi, getSessionToken } from "./src/api/client";
import LoginScreen from "./src/screens/LoginScreen";
import TicketListScreen from "./src/screens/TicketListScreen";
import NewTicketScreen from "./src/screens/NewTicketScreen";
import TicketDetailScreen from "./src/screens/TicketDetailScreen";
import PaywallScreen from "./src/screens/PaywallScreen";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export default function App() {
  const [user, setUser] = useState<any | null>(null);
  const [pushToken, setPushToken] = useState<string | null>(null);
  const [screen, setScreen] = useState<
    | { name: "list" }
    | { name: "new" }
    | { name: "paywall" }
    | { name: "detail"; ticketId: number }
  >({ name: "list" });

  // Restore session if token exists in SecureStore
  useEffect(() => {
    getSessionToken().then((token) => {
      if (token) {
        mobileApi
          .me()
          .then(setUser)
          .catch(() => setUser(null));
      }
    });
  }, []);

  // Register Expo Push Token when authenticated and listen for notification taps
  useEffect(() => {
    if (!user) return;
    let responseSub: Notifications.EventSubscription | undefined;

    (async () => {
      try {
        const perm = await Notifications.requestPermissionsAsync();
        if (perm.status === "granted") {
          const tokenData = await Notifications.getExpoPushTokenAsync();
          if (tokenData?.data) {
            setPushToken(tokenData.data);
            await mobileApi.registerPushToken(
              tokenData.data,
              Platform.OS === "ios"
                ? "ios"
                : Platform.OS === "android"
                  ? "android"
                  : "expo",
            );
          }
        }
      } catch {
        // Simulator / Expo Go fallback
      }
    })();

    // Deep link to ticket when user taps a push notification
    responseSub = Notifications.addNotificationResponseReceivedListener(
      (response) => {
        const data = response.notification.request.content.data as any;
        if (data?.ticketId) {
          setScreen({ name: "detail", ticketId: Number(data.ticketId) });
        }
      },
    );

    // Also support bekatos://tickets/:id deep links
    const linkSub = Linking.addEventListener("url", ({ url }) => {
      const match = url.match(/tickets\/(\d+)/);
      if (match) {
        setScreen({ name: "detail", ticketId: Number(match[1]) });
      }
    });

    return () => {
      responseSub?.remove();
      linkSub.remove();
    };
  }, [user]);

  const handleLogout = async () => {
    await mobileApi.logout(pushToken);
    setUser(null);
    setScreen({ name: "list" });
  };

  return (
    <>
      <StatusBar style="light" />
      {!user ? (
        <LoginScreen onAuthenticated={setUser} />
      ) : screen.name === "new" ? (
        <NewTicketScreen
          onCancel={() => setScreen({ name: "list" })}
          onCreated={(ticketId) => setScreen({ name: "detail", ticketId })}
        />
      ) : screen.name === "paywall" ? (
        <PaywallScreen
          onBack={() => setScreen({ name: "list" })}
          onPurchased={() => {
            mobileApi.me().then(setUser).catch(() => {});
          }}
        />
      ) : screen.name === "detail" ? (
        <TicketDetailScreen
          ticketId={screen.ticketId}
          user={user}
          onBack={() => setScreen({ name: "list" })}
        />
      ) : (
        <TicketListScreen
          user={user}
          onSelectTicket={(ticketId) =>
            setScreen({ name: "detail", ticketId })
          }
          onNewTicket={() => setScreen({ name: "new" })}
          onOpenPaywall={() => setScreen({ name: "paywall" })}
          onLogout={handleLogout}
        />
      )}
    </>
  );
}
