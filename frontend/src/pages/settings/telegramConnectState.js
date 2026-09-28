export function telegramConnectActionState({canWrite,busy,connecting}){
  return {
    disabled:!canWrite||busy,
    label:busy?"Havola yaratilmoqda...":connecting?"Ulash havolasini qayta ochish":"Telegram guruhini ulash",
  };
}

export const isCurrentTelegramConnectAttempt=({signal,attempt,currentAttempt})=>!signal?.aborted&&attempt===currentAttempt;

