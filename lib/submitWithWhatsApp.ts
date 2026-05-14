import api from "@/lib/api";

const WHATSAPP_NUMBER = "201067827621";

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
  const url = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
  window.open(url, "_blank");
  return res;
}
