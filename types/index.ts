export interface Service {
  title: string;
  description: string;
  icon: string;
}

export interface Package {
  name: string;
  price: number;
  currency: string;
  lessons: number;
  duration: string;
  featured?: boolean;
}

export interface RecordedCourse {
  name: string;
  price: number;
  currency: string;
  description: string;
  includes: string[];
}

export interface Testimonial {
  id: number;
  type: "youtube";
  videoId: string;
  name: string;
}

export interface BrandInfo {
  name: string;
  tagline: string;
  email: string;
  phone: string;
  whatsapp: string;
  social: {
    facebook: string;
    instagram: string;
    tiktok: string;
    youtube: string;
  };
}

export interface FreeTrialFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  interest: "Quran" | "Arabic" | "Islamic Studies";
  message?: string;
}

export interface ScholarshipFormData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  yearOfBirth: string;
  howHeard: "Friends" | "Social Media" | "Other";
  interests: ("Learn Quran" | "Learn Arabic" | "Learn Islamic Studies")[];
  aboutYourself: string;
}
