import type { BrandInfo, Service, Package, RecordedCourse, Testimonial } from "@/types";

export const BRAND: BrandInfo = {
  name: "My Institute",
  tagline: "Learn Quran, Arabic & Islam",
  email: "myinstitute2026@gmail.com",
  phone: "+201067827621",
  whatsapp: "+201067827621",
  social: {
    facebook: "https://www.facebook.com/share/17xu4XZuwg/",
    instagram: "https://www.instagram.com/myinstitute.offecial",
    tiktok: "https://www.tiktok.com/@myinstitute.official",
    youtube: "https://www.youtube.com/@myinstitute.official",
  },
};

export const SERVICES: Service[] = [
  {
    title: "Islamic Religion",
    description:
      "Comprehensive and engaging lessons that help students understand the foundations of the Islamic religion. Our teaching focuses on building strong faith, good morals, and a clear understanding of Islamic principles in a simple and modern educational style.",
    icon: "BookOpen",
  },
  {
    title: "Quran Memorization",
    description:
      "Our Quran memorization program is designed to help students memorize the Holy Quran with accuracy and confidence. We follow a structured method that ensures steady progress, proper Tajweed, and continuous revision to strengthen long-term memorization.",
    icon: "Heart",
  },
  {
    title: "Teaching Arabic",
    description:
      "Learn the Arabic language in an easy and interactive way, focusing on reading, writing, speaking, and understanding. Our lessons help students build strong language skills and connect with the beauty of the Arabic language and its rich culture.",
    icon: "Languages",
  },
];

export const PACKAGES: Package[] = [
  {
    name: "Simple",
    price: 16,
    currency: "£",
    lessons: 4,
    duration: "30 minutes per lesson",
    featured: false,
  },
  {
    name: "Pro",
    price: 32,
    currency: "£",
    lessons: 8,
    duration: "30 minutes per lesson",
    featured: true,
  },
  {
    name: "Elite",
    price: 80,
    currency: "£",
    lessons: 20,
    duration: "30 minutes per lesson",
    featured: false,
  },
];

export const RECORDED_COURSE: RecordedCourse = {
  name: "Quran Recorded Course",
  price: 20,
  currency: "£",
  description: "Learn Quran with us!",
  includes: [
    "Introduction",
    "16 recorded lessons",
    "5–7 minutes per lesson",
    "Professional teacher to ask questions",
  ],
};

export const ABOUT = {
  heading: "About Us",
  content:
    "My Institute is a dedicated Quran learning center committed to nurturing faith, knowledge, and character. We provide high-quality Quran courses for all ages and levels, focusing on proper recitation (Tajweed), memorization (Hifz), and understanding the meanings of the Holy Quran. Our experienced and caring instructors create a supportive and engaging learning environment that helps students grow spiritually and morally. At My Institute, we believe the Quran is a lifelong guide, and our mission is to make learning it accessible, meaningful, and inspiring for everyone.",
};

export const TESTIMONIALS: Testimonial[] = [
  {
    id: 1,
    type: "youtube",
    videoId: "kroQ4iB9iaY",
    name: "Hisham from the UK",
  },
  {
    id: 2,
    type: "youtube",
    videoId: "HfCaaMEWUeI",
    name: "How I Improved My Quran Recitation",
  },
  {
    id: 3,
    type: "youtube",
    videoId: "XlHTlDZ7oYI",
    name: "Rayhan — Student Feedback",
  },
  {
    id: 4,
    type: "youtube",
    videoId: "j94xOE44Xps",
    name: "Tinh from the UK — Student Feedback",
  },
];

export const WHY_CHOOSE_US = [
  {
    icon: "GraduationCap",
    title: "Expert Teachers",
    description: "Qualified instructors who make learning engaging and effective.",
  },
  {
    icon: "Clock",
    title: "Flexible Scheduling",
    description: "Lessons that fit around your life — morning, afternoon, or evening.",
  },
  {
    icon: "Users",
    title: "All Levels Welcome",
    description: "From complete beginners to advanced students — everyone is welcome.",
  },
  {
    icon: "User",
    title: "One-to-One Lessons",
    description: "Personal attention and tailored progress at your own pace.",
  },
  {
    icon: "TrendingUp",
    title: "Structured Learning",
    description: "A clear learning path with steady, measurable progress.",
  },
  {
    icon: "Gift",
    title: "Free Trial Available",
    description: "Try a free session before you commit — no pressure.",
  },
];

export const FAQS = [
  {
    question: "How do online lessons work?",
    answer:
      "Lessons are held live via video call (Zoom or Google Meet). You'll be connected one-to-one with your teacher at your chosen time. All you need is a device with a camera, microphone, and a stable internet connection.",
  },
  {
    question: "What platform do you use for lessons?",
    answer:
      "We use Zoom or Google Meet for our lessons. Both are free to download and easy to use. Your teacher will send you the meeting link before each session.",
  },
  {
    question: "What ages do you teach?",
    answer:
      "We teach students of all ages — from young children (5+) to adults. Our teachers adapt their style and pace to suit each learner, whether they are complete beginners or more advanced.",
  },
  {
    question: "Do I need any prior knowledge?",
    answer:
      "No prior knowledge is required at all. We welcome complete beginners and will start from the basics. Our teachers assess each student's level at the beginning and tailor the lessons accordingly.",
  },
  {
    question: "How long is each lesson?",
    answer:
      "Each lesson is 30 minutes. This duration is ideal for focused, productive learning without fatigue — especially for younger students.",
  },
  {
    question: "Can I change my package later?",
    answer:
      "Yes, absolutely. You can upgrade or change your package at any time. Simply contact us via WhatsApp or email and we'll arrange it for you.",
  },
];
