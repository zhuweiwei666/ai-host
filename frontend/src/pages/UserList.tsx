import React, { useEffect, useState } from 'react';
import { User, getUsers, rechargeUser, initAdminUser } from '../api';

const UserList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [showRechargeModal, setShowRechargeModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [rechargeAmount, setRechargeAmount] = useState(100);

  const fetchUsers = async () => {
    try {
      const res = await getUsers();
      setUsers(res.data);
    } catch (error) {
      console.error('Failed to fetch users', error);
    }
  };

  useEffect(() => {
    // Ensure admin user exists on load, then fetch list
    initAdminUser().then(() => fetchUsers()).catch(console.error);
  }, []);

  const handleRechargeClick = (user: User) => {
    setSelectedUser(user);
    setRechargeAmount(100);
    setShowRechargeModal(true);
  };

  const confirmRecharge = async () => {
    if (!selectedUser) return;
    try {
      await rechargeUser(selectedUser._id, rechargeAmount);
      alert(`Successfully recharged ${rechargeAmount} coins for ${selectedUser.username}`);
      setShowRechargeModal(false);
      fetchUsers(); // Refresh list to show new balance
    } catch (error) {
      alert('Recharge failed');
      console.error(error);
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-8">
      {/* Sidebar removed */}
      
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">用户管理 (User Management)</h2>
          <p className="text-sm text-gray-500 mt-1">Manage users and their wallet balances.</p>
        </div>
        <button 
          onClick={fetchUsers} 
          className="px-4 py-2 bg-white border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Refresh List
        </button>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-lg">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Username</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance (AI Coins)</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created At</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map((user) => (
              <tr key={user._id}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="h-10 w-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <div className="ml-4">
                      <div className="text-sm font-medium text-gray-900">{user.username}</div>
                      <div className="text-sm text-gray-500">{user.email || 'No email'}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {user.role}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-bold">
                  💎 {user.balance ?? 0}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(user.createdAt).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <button 
                    onClick={() => handleRechargeClick(user)}
                    className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 px-3 py-1 rounded-md transition-colors"
                  >
                    充值 (Recharge)
                  </button>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                  No users found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Recharge Modal */}
      {showRechargeModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-6 animate-scale-in">
            <h3 className="text-lg font-bold mb-4">Recharge Wallet</h3>
            <p className="text-sm text-gray-600 mb-4">
              Add AI Coins to <strong>{selectedUser.username}</strong>
            </p>
            
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Amount</label>
              <input 
                type="number" 
                min="1"
                className="w-full border border-gray-300 rounded-md px-3 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                value={rechargeAmount}
                onChange={(e) => setRechargeAmount(Number(e.target.value))}
              />
              <div className="flex gap-2 mt-2">
                {[100, 500, 1000, 5000].map(amt => (
                  <button
                    key={amt}
                    onClick={() => setRechargeAmount(amt)}
                    className={`px-2 py-1 text-xs rounded border ${rechargeAmount === amt ? 'bg-indigo-100 border-indigo-500 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                  >
                    +{amt}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="flex justify-end gap-3">
              <button 
                onClick={() => setShowRechargeModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-md"
              >
                Cancel
              </button>
              <button 
                onClick={confirmRecharge}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 font-medium"
              >
                Confirm Recharge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserList;
