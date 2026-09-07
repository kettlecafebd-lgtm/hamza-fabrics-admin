import React, { useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

const PrivacyPolicy = () => {
  const { shopTheme, isShopDark } = useContext(ThemeContext);
  const isDark = isShopDark;
  const bgCard = isDark ? 'bg-gray-800' : 'bg-white';
  const textColor = isDark ? 'text-gray-100' : 'text-gray-800';
  const mutedText = isDark ? 'text-gray-400' : 'text-gray-500';
  const borderColor = isDark ? 'border-gray-700' : 'border-gray-200';
  const inputBg = isDark ? 'bg-gray-700' : 'bg-gray-50';

   useEffect(() => {
    window.scrollTo(0, 0);
  }, []);
  return (
    <div className="max-w-4xl mx-auto py-20 px-6 font-sans text-t-main leading-relaxed mt-20"> 
      <h1 className="text-4xl font-black mb-6">Privacy Policy</h1>
      <p className="text-sm text-t-muted mb-8">Last Updated: July 4, 2026</p>
      
      <p className="mb-6">At <strong>Hamza Fabrics</strong>, we are committed to protecting your privacy. This policy outlines how we collect, use, and safeguard your personal information when you visit our website or interact with our physical shop.</p>
      
      <h2 className="text-2xl font-bold mt-8 mb-4">Information We Collect</h2>
      <ul className="list-disc ml-6 space-y-2 mb-6">
        <li><strong>Personal Information:</strong> We collect data such as your name, delivery address, email, phone number, and payment details when you place an order.</li>
        <li><strong>Automated Data:</strong> We may collect technical information via cookies, such as your IP address, browser type, and navigation patterns to enhance your shopping experience.</li>
      </ul>

      <h2 className="text-2xl font-bold mt-8 mb-4">How We Use Your Information</h2>
      <ul className="list-disc ml-6 space-y-2 mb-6">
        <li>To process and deliver your orders accurately.</li>
        <li>To provide order updates, customer support, and delivery notifications.</li>
        <li>To improve our website functionality and keep you informed about our products and offers (if subscribed).</li>
      </ul>

      <h2 className="text-2xl font-bold mt-8 mb-4">Data Security & Information Sharing</h2>
      <p className="mb-4">We employ industry-standard security measures, including encryption and secure servers, to protect your information from unauthorized access or theft.</p>
      <p className="mb-6">We do not sell your personal data. We only share necessary information with trusted third parties, such as courier services for delivery and payment gateways for transaction processing, as required by law.</p>

      <h2 className="text-2xl font-bold mt-8 mb-4">Your Rights & Contact Information</h2>
      <p className="mb-4">You have the right to access, update, or request the deletion of your personal data at any time. You may also opt-out of our marketing communications.</p>
      
      <div className="bg-t-base p-6 rounded-xl border border-t-border mt-6">
        <p><strong>Address:</strong> G9, Krishi Market, Mohammadpur, Dhaka, 1207, Bangladesh</p>
        <p><strong>Email:</strong> service@hamzafabrics.com</p>
        <p><strong>Phone:</strong> 01710-497431</p>
      </div>
    </div>
  );
};

export default PrivacyPolicy;