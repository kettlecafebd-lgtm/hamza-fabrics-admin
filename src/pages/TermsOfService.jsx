import React, { useEffect, useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';

const TermsOfService = () => {
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
      <h1 className="text-4xl font-black mb-6">Terms of Service</h1>
      <p className="text-sm text-t-muted mb-8">Last Updated: July 4, 2026</p>
      
      <p className="mb-6">Welcome to <strong>Hamza Fabrics</strong>. By using our website and services, you agree to comply with the following terms and conditions.</p>
      
      <h2 className="text-2xl font-bold mt-8 mb-4">General Conditions</h2>
      <p className="mb-6">By placing an order, you confirm that you are at least 18 years of age or are using our services under the supervision of a parent or guardian. All content on this website, including images and logos, is the property of Hamza Fabrics and is protected by copyright laws.</p>
      
      <h2 className="text-2xl font-bold mt-8 mb-4">Orders, Pricing, & Delivery</h2>
      <ul className="list-disc ml-6 space-y-2 mb-6">
        <li><strong>Product Descriptions:</strong> We strive for accuracy; however, colors may vary slightly based on display settings.</li>
        <li><strong>Pricing:</strong> We reserve the right to update product prices at any time, though confirmed orders will be honored at the price existing at the time of purchase.</li>
        <li><strong>Delivery:</strong> We endeavor to deliver orders within the promised timeframe, but are not liable for delays caused by unforeseen circumstances like political instability or natural disasters.</li>
      </ul>

      <h2 className="text-2xl font-bold mt-8 mb-4">Returns & Refunds</h2>
      <p className="mb-6">Please inspect your items upon delivery. Any claims regarding defective or incorrect items must be made within 3 days of receipt. Items must be unused and in original packaging for a valid return or exchange.</p>

      <h2 className="text-2xl font-bold mt-8 mb-4">Limitation of Liability & Governing Law</h2>
      <p className="mb-4">Hamza Fabrics shall not be held liable for any indirect or consequential damages arising from the use of our services or website.</p>
      <p className="mb-6">These terms shall be governed by and construed in accordance with the laws of Bangladesh. Any disputes will be subject to the jurisdiction of the courts in Dhaka.</p>
      
      <div className="bg-t-base p-6 rounded-xl border border-t-border mt-6">
        <p><strong>Contact us for any concerns:</strong></p>
        <p><strong>Address:</strong> G9, Krishi Market, Mohammadpur, Dhaka, 1207, Bangladesh</p>
        <p><strong>Email:</strong> service@hamzafabrics.com</p>
        <p><strong>Phone:</strong> 01710-497431</p>
      </div>
    </div>
  );
};

export default TermsOfService;