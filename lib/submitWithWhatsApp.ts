import api from "@/lib/api";
import { BRAND } from "@/lib/content";
import { whatsAppUrl } from "@/lib/labels";

interface SubmitWithWhatsAppOptions<T> {
  endpoint: string;
  formData: T;
  whatsappTemplate: (data: T) => string;
}

export async function submitWithWhatsApp<T>({
  endpoint,
  formData,
  whatsappTemplate,
}: SubmitWithWhatsAppOptions<T>) {
  const res = await api.post(endpoint, formData);
  const message = whatsappTemplate(formData);
  const url = whatsAppUrl(BRAND.whatsapp, message);
  window.open(url ?? undefined, "_blank");
  return res;
}
