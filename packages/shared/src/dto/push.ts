/** Web Push subscription payload, as returned by PushManager.subscribe(). */
export interface PushSubscriptionRequestDto {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
}

export interface PushPublicKeyDto {
  publicKey: string;
}
