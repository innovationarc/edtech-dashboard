import { useState } from 'react';
import { X, CreditCard, Plus } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';

interface PaymentModalProps {
  onClose: () => void;
}

const PaymentModal = ({ onClose }: PaymentModalProps) => {
  const [cardNumber, setCardNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [cvv, setCvv] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      // Initialize Stripe (replace with your publishable key)
      const stripe = await loadStripe('your_publishable_key');
      
      // Here you would typically:
      // 1. Send card details to your server
      // 2. Create a payment method/setup intent
      // 3. Handle the response
      
      onClose();
    } catch (err) {
      setError('Failed to process payment method');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-background-900 rounded-xl w-full max-w-md p-6 relative">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-white"
        >
          <X size={20} />
        </button>

        <h2 className="text-2xl font-bold text-white mb-6">Add Payment Method</h2>

        {error && (
          <div className="bg-error-dark text-error-light px-4 py-2 rounded mb-4">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Card Number</label>
            <div className="relative">
              <input
                type="text"
                value={cardNumber}
                onChange={(e) => setCardNumber(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="1234 5678 9012 3456"
                maxLength={19}
              />
              <CreditCard size={16} className="absolute left-3 top-3 text-gray-400" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Expiry Date</label>
              <input
                type="text"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="MM/YY"
                maxLength={5}
              />
            </div>

            <div>
              <label className="block text-sm text-gray-400 mb-1">CVV</label>
              <input
                type="text"
                value={cvv}
                onChange={(e) => setCvv(e.target.value)}
                className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="123"
                maxLength={4}
              />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1">Name on Card</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="John Doe"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            <Plus size={16} />
            <span>Add Card</span>
          </button>
        </form>

        <div className="mt-4 text-center">
          <p className="text-sm text-gray-400">
            Your payment information is securely processed by Stripe
          </p>
        </div>
      </div>
    </div>
  );
};

export default PaymentModal;
