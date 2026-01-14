import { useState, useEffect } from 'react';
import { CreditCard, Search, Download, RefreshCw, Loader } from 'lucide-react';
import Card from '../components/ui/Card';
import { paymentService, Transaction, PaymentGateway } from '../services/paymentService';

const PaymentManagement = () => {
  const [activeTab, setActiveTab] = useState<'gateways' | 'transactions' | 'reports'>('gateways');
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [transactionsData, gatewaysData] = await Promise.all([
        paymentService.getAllTransactions(),
        paymentService.getAllGateways()
      ]);
      setTransactions(transactionsData);
      setGateways(gatewaysData);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadData();
  };

  const handleGatewayToggle = async (gatewayId: string, enabled: boolean) => {
    try {
      await paymentService.updateGateway(gatewayId, { enabled });
      setGateways(gateways.map(gateway => 
        gateway.id === gatewayId ? { ...gateway, enabled } : gateway
      ));
    } catch (error: any) {
      setError(error.message);
    }
  };

  const filteredTransactions = transactions.filter(transaction => {
    const matchesSearch = transaction.userName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         transaction.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         transaction.transactionId.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || transaction.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader size={32} className="animate-spin text-primary-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Payment Management</h1>

      {error && (
        <div className="bg-error-dark text-error-light px-4 py-2 rounded">
          {error}
        </div>
      )}

      <div className="bg-card rounded-xl shadow-card overflow-hidden">
        <div className="border-b border-background-800">
          <div className="flex">
            <button
              className={`px-6 py-4 border-b-2 transition-colors ${
                activeTab === 'gateways'
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('gateways')}
            >
              Payment Gateways
            </button>
            <button
              className={`px-6 py-4 border-b-2 transition-colors ${
                activeTab === 'transactions'
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('transactions')}
            >
              Transaction History
            </button>
            <button
              className={`px-6 py-4 border-b-2 transition-colors ${
                activeTab === 'reports'
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400 hover:text-white'
              }`}
              onClick={() => setActiveTab('reports')}
            >
              Payment Reports
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'gateways' && (
            <div className="space-y-6">
              {gateways.map((gateway) => (
                <Card key={gateway.id} className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-lg bg-background-800 flex items-center justify-center">
                        <CreditCard size={24} className="text-primary-500" />
                      </div>
                      <div>
                        <h3 className="text-white font-medium">{gateway.name}</h3>
                        <p className="text-sm text-gray-400">
                          {gateway.status === 'connected' ? 'Connected' : 'Not Connected'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => handleGatewayToggle(gateway.id, !gateway.enabled)}
                        className={`px-4 py-2 rounded-lg transition-colors ${
                          gateway.enabled
                            ? 'bg-success-dark text-success-light'
                            : 'bg-background-800 text-gray-400'
                        }`}
                      >
                        {gateway.enabled ? 'Enabled' : 'Disabled'}
                      </button>
                      <button className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors">
                        Configure
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {activeTab === 'transactions' && (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="relative flex-1 max-w-md">
                  <input
                    type="text"
                    placeholder="Search transactions..."
                    className="w-full bg-background-800 text-white rounded-lg py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search size={18} className="absolute left-3 top-2.5 text-gray-400" />
                </div>

                <div className="flex gap-4">
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="bg-background-800 text-white rounded-lg py-2 px-4 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="all">All Status</option>
                    <option value="success">Success</option>
                    <option value="failed">Failed</option>
                    <option value="pending">Pending</option>
                    <option value="refunded">Refunded</option>
                  </select>

                  <button 
                    onClick={handleRefresh}
                    className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded-lg transition-colors"
                  >
                    <RefreshCw size={18} />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-background-800">
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Transaction ID</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">User</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Amount</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Status</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Gateway</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Product</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Date</th>
                      <th className="p-4 text-xs uppercase text-gray-400 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredTransactions.map((transaction) => (
                      <tr key={transaction.id} className="border-b border-background-800">
                        <td className="p-4 text-white">{transaction.transactionId}</td>
                        <td className="p-4 text-white">{transaction.userName}</td>
                        <td className="p-4 text-white">
                          {transaction.amount} {transaction.currency}
                        </td>
                        <td className="p-4">
                          <span
                            className={`px-2 py-1 rounded-full text-xs ${
                              transaction.status === 'success'
                                ? 'bg-success-dark text-success-light'
                                : transaction.status === 'failed'
                                ? 'bg-error-dark text-error-light'
                                : transaction.status === 'pending'
                                ? 'bg-warning-dark text-warning-light'
                                : 'bg-background-700 text-gray-300'
                            }`}
                          >
                            {transaction.status}
                          </span>
                        </td>
                        <td className="p-4 text-white">{transaction.gateway}</td>
                        <td className="p-4 text-white">{transaction.productName}</td>
                        <td className="p-4 text-white">
                          {transaction.createdAt.toLocaleDateString()}
                        </td>
                        <td className="p-4">
                          <button className="text-primary-400 hover:text-primary-300">
                            View Details
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {filteredTransactions.length === 0 && (
                <div className="py-8 text-center text-gray-400">
                  No transactions found matching your criteria.
                </div>
              )}
            </div>
          )}

          {activeTab === 'reports' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Card className="p-6 cursor-pointer hover:bg-background-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <Download size={24} className="text-primary-500" />
                    <div>
                      <h3 className="text-white font-medium">Sales Summary</h3>
                      <p className="text-sm text-gray-400">Download detailed sales report</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 cursor-pointer hover:bg-background-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <Download size={24} className="text-secondary-500" />
                    <div>
                      <h3 className="text-white font-medium">Refund Details</h3>
                      <p className="text-sm text-gray-400">Download refund transactions</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-6 cursor-pointer hover:bg-background-800 transition-colors">
                  <div className="flex items-center gap-4">
                    <Download size={24} className="text-accent-500" />
                    <div>
                      <h3 className="text-white font-medium">Failed Transactions</h3>
                      <p className="text-sm text-gray-400">Download failed payment attempts</p>
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentManagement;