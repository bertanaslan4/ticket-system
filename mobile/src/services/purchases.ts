import { Platform } from "react-native";
import { mobileApi } from "../api/client.js";

export interface PurchaseResult {
  ok: boolean;
  product_id?: string;
  customer_info?: any;
  error?: string;
}

export class PurchasesService {
  private static configured = false;
  private static appUserId: string | null = null;

  /**
   * Initializes RevenueCat Purchases SDK with workspace/tenant app_user_id.
   * In Expo Go or mock environment, gracefully marks as configured without throwing.
   */
  static async configure(appUserId?: string) {
    if (appUserId) {
      this.appUserId = appUserId;
    }

    try {
      // Dynamic import to allow running in environments without react-native-purchases linked
      // @ts-ignore
      const PurchasesModule = await import("react-native-purchases").catch(() => null);
      if (PurchasesModule?.default) {
        const Purchases = PurchasesModule.default;
        const apiKey =
          Platform.OS === "ios"
            ? process.env.EXPO_PUBLIC_RC_IOS_KEY || "appl_mock_revenuecat_key"
            : process.env.EXPO_PUBLIC_RC_ANDROID_KEY || "goog_mock_revenuecat_key";

        Purchases.configure({
          apiKey,
          appUserID: this.appUserId || undefined,
        });
        this.configured = true;
      }
    } catch {
      // Graceful fallback for mock / Expo Go
      this.configured = false;
    }
  }

  /**
   * Restores past purchases from App Store or Google Play and refreshes tenant catalog.
   */
  static async restorePurchases(): Promise<PurchaseResult> {
    try {
      // @ts-ignore
      const PurchasesModule = await import("react-native-purchases").catch(() => null);
      if (PurchasesModule?.default && this.configured) {
        const customerInfo = await PurchasesModule.default.restorePurchases();
        return { ok: true, customer_info: customerInfo };
      }

      // Offline / Direct backend verification fallback
      const catalog = await mobileApi.getBillingCatalog();
      return { ok: true, customer_info: catalog?.workspace || catalog?.tenant };
    } catch (err: any) {
      return { ok: false, error: err.message || "restore_failed" };
    }
  }

  /**
   * Purchases a product/plan through native store or backend API.
   */
  static async purchaseProduct(
    productId: string,
    store: "app_store" | "play_store" | "stripe" = Platform.OS === "android"
      ? "play_store"
      : "app_store",
  ): Promise<PurchaseResult> {
    try {
      // @ts-ignore
      const PurchasesModule = await import("react-native-purchases").catch(() => null);
      if (PurchasesModule?.default && this.configured) {
        const { customerInfo } = await PurchasesModule.default.purchaseProduct(productId);
        return { ok: true, product_id: productId, customer_info: customerInfo };
      }

      // Backend fallback purchase
      await mobileApi.purchaseIap(productId, store);
      return { ok: true, product_id: productId };
    } catch (err: any) {
      return { ok: false, error: err.message || "purchase_failed" };
    }
  }
}
