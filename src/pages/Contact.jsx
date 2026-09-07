import React, { useState, useEffect, useContext, useRef } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import toast from 'react-hot-toast';
import { ChevronLeft, ChevronRight, X, MapPin, Phone, Mail, Clock } from 'lucide-react';
import API_BASE_URL from '../config/api';

export default function Contact() {
  const { shopTheme, isShopDark } = useContext(ThemeContext);

  const [siteSettings, setSiteSettings] = useState({
    contactInfo: {
      address: "Mohammadpur\nDhaka, Bangladesh\n(By Appointment Only)",
      phone: "+880 1711-000000",
      email: "support@hamzafabrics.com",
      hours: "Saturday - Thursday\n10:00 AM - 8:00 PM (BDT)"
    }
  });

  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [galleryIdx, setGalleryIdx] = useState(0);
  const [showLightbox, setShowLightbox] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const autoPlayRef = useRef(null);

  useEffect(() => {
    const savedSettings = localStorage.getItem('siteSettings');
    if (savedSettings) {
      const parsed = JSON.parse(savedSettings);
      setSiteSettings(prev => ({
        ...prev,
        contactInfo: parsed.contactInfo || prev.contactInfo
      }));
    }
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.email || !formData.message) {
      return toast.error('Please fill out all fields.');
    }
    setIsSubmitting(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 1500));
      toast.success("Message sent! We'll get back to you soon.");
      setFormData({ name: '', email: '', message: '' });
    } catch (error) {
      toast.error('Failed to send message.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const images = siteSettings.contactInfo.contactImages?.filter(Boolean) || [];

  // Auto-swipe gallery with 3D style
  useEffect(() => {
    if (!isAutoPlaying || images.length <= 1) return;
    autoPlayRef.current = setInterval(() => {
      setGalleryIdx(prev => (prev + 1) % images.length);
    }, 3500);
    return () => clearInterval(autoPlayRef.current);
  }, [isAutoPlaying, images.length]);

  const nextImage = () => {
    setIsAutoPlaying(false);
    setGalleryIdx(prev => (prev + 1) % images.length);
  };
  const prevImage = () => {
    setIsAutoPlaying(false);
    setGalleryIdx(prev => (prev - 1 + images.length) % images.length);
  };

  return (
    <div className={`bg-t-base min-h-screen font-sans text-t-main flex flex-col transition-colors duration-300 ${shopTheme}`}>

      {/* Main Content */}
      <div className="flex-grow max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 w-full">
        <div className="text-center mb-12">
          <span className="text-xs tracking-[0.2em] text-t-primary uppercase font-bold mb-3 block">Concierge & Support</span>
          <h1 className="text-3xl md:text-5xl font-serif text-t-main mb-4 tracking-tight">Get in Touch</h1>
          <p className="text-t-muted max-w-xl mx-auto font-medium text-sm leading-relaxed">Whether you're looking for styling advice, order tracking, or wholesale inquiries — we're here to assist.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
          {/* Contact Details */}
          <div className="space-y-6">
            <div className="bg-t-surface p-6 rounded-2xl border border-t-border flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-t-primary/10 flex items-center justify-center shrink-0">
                <MapPin size={18} className="text-t-primary" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-widest uppercase text-t-main mb-2">Flagship Studio</h3>
                <p className="text-t-muted leading-relaxed font-medium text-sm whitespace-pre-line">{siteSettings.contactInfo.address}</p>
              </div>
            </div>
            <div className="bg-t-surface p-6 rounded-2xl border border-t-border flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-t-primary/10 flex items-center justify-center shrink-0">
                <Phone size={18} className="text-t-primary" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-widest uppercase text-t-main mb-2">Direct Contact</h3>
                <p className="text-t-muted font-medium text-sm">Phone/WhatsApp: <strong className="text-t-main">{siteSettings.contactInfo.phone}</strong></p>
                <p className="text-t-muted font-medium text-sm">Email: <strong className="text-t-main">{siteSettings.contactInfo.email}</strong></p>
              </div>
            </div>
            <div className="bg-t-surface p-6 rounded-2xl border border-t-border flex items-start gap-4 hover:shadow-md transition-shadow">
              <div className="w-10 h-10 rounded-xl bg-t-primary/10 flex items-center justify-center shrink-0">
                <Clock size={18} className="text-t-primary" />
              </div>
              <div>
                <h3 className="text-xs font-black tracking-widest uppercase text-t-main mb-2">Business Hours</h3>
                <p className="text-t-muted font-medium text-sm whitespace-pre-line">{siteSettings.contactInfo.hours}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-t-surface p-8 rounded-2xl border border-t-border shadow-lg shadow-t-primary/5">
            <h3 className="text-xl font-serif text-t-main mb-6">Send an Inquiry</h3>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase text-t-muted mb-1.5">Full Name</label>
                <input type="text" name="name" value={formData.name} onChange={handleChange}
                  className="w-full border-b-2 border-t-border focus:border-t-primary bg-transparent py-2 outline-none transition-colors text-t-main font-semibold text-sm"
                  placeholder="Jane Doe" />
              </div>
              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase text-t-muted mb-1.5">Email</label>
                <input type="email" name="email" value={formData.email} onChange={handleChange}
                  className="w-full border-b-2 border-t-border focus:border-t-primary bg-transparent py-2 outline-none transition-colors text-t-main font-semibold text-sm"
                  placeholder="jane@example.com" />
              </div>
              <div>
                <label className="block text-[10px] font-black tracking-widest uppercase text-t-muted mb-1.5">Message</label>
                <textarea rows="3" name="message" value={formData.message} onChange={handleChange}
                  className="w-full border-b-2 border-t-border focus:border-t-primary bg-transparent py-2 outline-none transition-colors resize-none text-t-main font-semibold text-sm custom-scrollbar"
                  placeholder="How can we help you?" />
              </div>
              <button type="submit" disabled={isSubmitting}
                className={`w-full text-white py-3.5 text-xs font-black uppercase tracking-[0.2em] transition-all rounded-xl shadow-lg ${isSubmitting ? 'bg-t-muted cursor-not-allowed' : 'bg-t-primary hover:opacity-90 shadow-t-primary/30'}`}>
                {isSubmitting ? 'Sending...' : 'Send Message'}
              </button>
            </form>
          </div>
        </div>

        {/* ═══ Map (4/3) + Gallery Strip (4/1 auto-swipe 3D) ═══ */}
        {(siteSettings.contactInfo.mapEmbed || images.length > 0) && (
          <div className="mt-14">
            <hr className="border-t-border mb-8" />
            <h3 className="text-sm font-black tracking-widest uppercase text-t-main text-center mb-6">Find Us</h3>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Map — 4:3 Aspect Ratio, Full Width on its side */}
              {siteSettings.contactInfo.mapEmbed && (
                <div className="rounded-2xl overflow-hidden border border-t-border shadow-lg aspect-[4/3]">
                  <div className="w-full h-full [&>iframe]:w-full [&>iframe]:h-full" dangerouslySetInnerHTML={{ __html: siteSettings.contactInfo.mapEmbed }} />
                </div>
              )}

              {/* Gallery — 3D Auto-Swipe Carousel */}
              {images.length > 0 && (
                <div className="relative rounded-2xl overflow-hidden border border-t-border shadow-lg bg-t-base aspect-[4/3]"
                  onMouseEnter={() => setIsAutoPlaying(false)}
                  onMouseLeave={() => setIsAutoPlaying(true)}
                >
                  {/* 3D Perspective Container */}
                  <div className="w-full h-full relative" style={{ perspective: '1200px' }}>
                    {images.map((img, i) => {
                      const offset = i - galleryIdx;
                      const isActive = i === galleryIdx;
                      const absOffset = Math.abs(offset);
                      // Only render nearby images for performance
                      if (absOffset > 2) return null;

                      return (
                        <div
                          key={i}
                          className="absolute inset-0 transition-all duration-700 ease-out cursor-pointer"
                          style={{
                            transform: `translateX(${offset * 30}%) translateZ(${-absOffset * 60}px) rotateY(${offset * -8}deg)`,
                            opacity: absOffset === 0 ? 1 : absOffset === 1 ? 0.6 : 0.3,
                            zIndex: 10 - absOffset,
                            filter: isActive ? 'none' : `blur(${absOffset * 1}px)`,
                          }}
                          onClick={() => {
                            setLightboxIdx(i);
                            setShowLightbox(true);
                          }}
                        >
                          <img src={img} alt="" className="w-full h-full object-cover" />
                        </div>
                      );
                    })}
                  </div>

                  {/* Nav Arrows */}
                  {images.length > 1 && (
                    <>
                      <button onClick={prevImage}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-20 hover:bg-black/60 transition-colors">
                        <ChevronLeft size={18} />
                      </button>
                      <button onClick={nextImage}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 backdrop-blur-sm text-white flex items-center justify-center z-20 hover:bg-black/60 transition-colors">
                        <ChevronRight size={18} />
                      </button>
                    </>
                  )}

                  {/* Dots */}
                  {images.length > 1 && (
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-20">
                      {images.map((_, i) => (
                        <button key={i} onClick={() => { setIsAutoPlaying(false); setGalleryIdx(i); }}
                          className={`h-1.5 rounded-full transition-all duration-300 ${i === galleryIdx ? 'bg-white w-5' : 'bg-white/40 w-1.5 hover:bg-white/60'}`} />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ═══ Full-Screen Lightbox ═══ */}
      {showLightbox && (
        <div className="fixed inset-0 z-[200] bg-black/95 flex items-center justify-center p-4" onClick={() => setShowLightbox(false)}>
          <button onClick={() => setShowLightbox(false)}
            className="absolute top-4 right-4 z-[210] bg-white/10 text-white hover:bg-red-500 w-10 h-10 rounded-full flex items-center justify-center transition-colors">
            <X size={20} />
          </button>

          <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(prev => (prev - 1 + images.length) % images.length); }}
            className="absolute left-4 top-1/2 -translate-y-1/2 z-[210] bg-white/10 text-white hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors">
            <ChevronLeft size={24} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); setLightboxIdx(prev => (prev + 1) % images.length); }}
            className="absolute right-4 top-1/2 -translate-y-1/2 z-[210] bg-white/10 text-white hover:bg-white/20 w-12 h-12 rounded-full flex items-center justify-center transition-colors">
            <ChevronRight size={24} />
          </button>

          <img src={images[lightboxIdx]} alt=""
            className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl cursor-zoom-out"
            onClick={(e) => e.stopPropagation()} />

          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-[210]">
            {images.map((_, i) => (
              <button key={i} onClick={(e) => { e.stopPropagation(); setLightboxIdx(i); }}
                className={`h-1.5 rounded-full transition-all ${i === lightboxIdx ? 'bg-white w-5' : 'bg-white/30 w-1.5'}`} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
