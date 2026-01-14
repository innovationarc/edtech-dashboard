import { useState } from 'react';
import { Save, Upload, Globe, Mail, BellRing, Lock, Users, Palette, Shield, MessageSquare } from 'lucide-react'; // Import MessageSquare
import Card from '../components/ui/Card';
import { useDashboard } from '../contexts/DashboardContext';
import MyQAActivity from '../components/settings/MyQAActivity'; // Import MyQAActivity
import ChangePasswordForm from '../components/profile/ChangePasswordForm'; // Import ChangePasswordForm

const Settings = () => {
  const { user } = useDashboard();
  const [activeTab, setActiveTab] = useState('general');
  
  // Check if user is admin
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isTeacher = user?.role === 'teacher';
  
  const tabs = [
    { id: 'general', label: 'General', icon: <Globe size={18} />, adminOnly: true },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={18} />, adminOnly: false },
    { id: 'password', label: 'Change Password', icon: <Lock size={18} />, adminOnly: false },
    { id: 'notifications', label: 'Notifications', icon: <BellRing size={18} />, adminOnly: false },
    { id: 'security', label: 'Security', icon: <Lock size={18} />, adminOnly: true },
    { id: 'users', label: 'Users & Permissions', icon: <Users size={18} />, adminOnly: true },
    { id: 'qa-activity', label: 'My Q&A Activity', icon: <MessageSquare size={18} />, adminOnly: false, roles: ['student', 'teacher'] }, // New Q&A tab
  ];

  // Filter tabs based on user role
  const filteredTabs = tabs.filter(tab => {
    if (tab.adminOnly && !isAdmin) return false;
    if (tab.roles && user) {
      return tab.roles.includes(user.role);
    }
    return true;
  });

  // If not admin and trying to access admin-only tab, redirect to general
  if (!isAdmin && ['security', 'users'].includes(activeTab)) {
    setActiveTab('general');
  }
  // If not student/teacher and trying to access Q&A tab, redirect to general
  if (!isStudent && !isTeacher && activeTab === 'qa-activity') {
    setActiveTab('general');
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Settings</h1>
        <p className="text-sm text-gray-400 mt-1">
          {isAdmin ? 'Administrator settings' : 'User preferences'}
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-1">
          <Card className="p-0">
            <ul className="py-2">
              {filteredTabs.map((tab) => (
                <li key={tab.id}>
                  <button
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left ${
                      activeTab === tab.id
                        ? 'bg-primary-900/40 text-primary-300 border-l-2 border-primary-500'
                        : 'text-gray-300 hover:bg-background-800 hover:text-white'
                    }`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.icon}
                    <span>{tab.label}</span>
                    {tab.adminOnly && (
                      <Shield size={14} className="text-secondary-400 ml-auto" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        
        <div className="lg:col-span-4">
          {activeTab === 'general' && <GeneralSettings />}
          {activeTab === 'appearance' && <AppearanceSettings />}
          {activeTab === 'password' && (
            <Card title="Change Password" subtitle="Update your account password">
              <ChangePasswordForm />
            </Card>
          )}
          {activeTab === 'notifications' && <NotificationSettings />}
          {activeTab === 'security' && isAdmin && <SecuritySettings />}
          {activeTab === 'users' && isAdmin && <UsersPermissionsSettings />}
          {activeTab === 'qa-activity' && (isStudent || isTeacher) && <MyQAActivity />} {/* Render MyQAActivity */}
        </div>
      </div>
    </div>
  );
};

const GeneralSettings = () => {
  return (
    <Card title="General Settings">
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-1">Site Name</label>
          <input
            type="text"
            defaultValue="Learning Management Portal"
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Site Tagline</label>
          <input
            type="text"
            defaultValue="Empowering educators, inspiring students"
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Contact Email</label>
          <div className="flex">
            <div className="flex-shrink-0 bg-background-700 flex items-center px-3 rounded-l">
              <Mail size={18} className="text-gray-400" />
            </div>
            <input
              type="email"
              defaultValue="admin@example.com"
              className="flex-1 bg-background-800 text-white rounded-r py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-3">Logo</label>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 bg-primary-900 rounded flex items-center justify-center">
              <span className="text-2xl font-bold text-primary-300">L</span>
            </div>
            
            <div className="flex-1">
              <div className="border-2 border-dashed border-background-600 rounded p-4 text-center">
                <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                <p className="text-sm text-gray-400 mb-2">Drag and drop logo file or click to browse</p>
                <button className="text-sm bg-background-800 hover:bg-background-700 text-white py-1 px-3 rounded transition-colors">
                  Upload Logo
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-2">Recommended: 200x200px, PNG or SVG format</p>
            </div>
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Timezone</label>
          <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="utc">UTC (Coordinated Universal Time)</option>
            <option value="est">EST (Eastern Standard Time)</option>
            <option value="cst">CST (Central Standard Time)</option>
            <option value="mst">MST (Mountain Standard Time)</option>
            <option value="pst">PST (Pacific Standard Time)</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const AppearanceSettings = () => {
  const { 
    theme, 
    setTheme, 
    primaryColor, 
    setPrimaryColor, 
    accentColor, 
    setAccentColor,
    fontFamily,
    setFontFamily
  } = useDashboard();
  
  const themes = [
    { id: 'dark', name: 'Dark', colors: ['#0d1117', '#1f2937', '#374151'] },
    { id: 'light', name: 'Light', colors: ['#f9fafb', '#f3f4f6', '#e5e7eb'] },
    { id: 'purple', name: 'Purple', colors: ['#1e1b4b', '#312e81', '#4c1d95'] },
    { id: 'pink', name: 'Pink', colors: ['#831843', '#9d174d', '#be185d'] },
  ];

  const handleSaveSettings = () => {
    // Settings are automatically saved via context
    alert('Appearance settings saved successfully!');
  };
  
  return (
    <Card title="Appearance Settings">
      <div className="space-y-6">
        <div>
          <label className="block text-sm text-gray-400 mb-3">Color Theme</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {themes.map((themeOption) => (
              <div key={themeOption.id} className="flex flex-col items-center">
                <button
                  className={`h-20 w-full rounded-lg overflow-hidden p-0.5 mb-2 focus:outline-none transition-all ${
                    theme === themeOption.id 
                      ? 'ring-2 ring-primary-500 scale-105' 
                      : 'ring-1 ring-background-600 hover:ring-2 hover:ring-primary-400'
                  }`}
                  onClick={() => setTheme(themeOption.id)}
                >
                  <div className="h-full w-full grid grid-cols-3 rounded">
                    {themeOption.colors.map((color, idx) => (
                      <div key={idx} className="h-full" style={{ backgroundColor: color }}></div>
                    ))}
                  </div>
                </button>
                <span className={`text-sm transition-colors ${
                  theme === themeOption.id ? 'text-primary-300 font-medium' : 'text-gray-300'
                }`}>
                  {themeOption.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Primary Color</label>
          <div className="flex gap-4">
            <input
              type="color"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="h-10 w-10 rounded overflow-hidden bg-transparent border-0 cursor-pointer"
            />
            <input
              type="text"
              value={primaryColor}
              onChange={(e) => setPrimaryColor(e.target.value)}
              className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Accent Color</label>
          <div className="flex gap-4">
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="h-10 w-10 rounded overflow-hidden bg-transparent border-0 cursor-pointer"
            />
            <input
              type="text"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
        
        <div>
          <label className="block text-sm text-gray-400 mb-1">Font</label>
          <select 
            value={fontFamily}
            onChange={(e) => setFontFamily(e.target.value)}
            className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="inter">Inter</option>
            <option value="roboto">Roboto</option>
            <option value="open-sans">Open Sans</option>
            <option value="poppins">Poppins</option>
          </select>
        </div>
        
        <div>
          <label className="flex items-center gap-2 text-gray-300 cursor-pointer">
            <input
              type="checkbox"
              defaultChecked
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
            />
            <span>Enable animations</span>
          </label>
        </div>
        
        <div className="flex justify-end">
          <button 
            onClick={handleSaveSettings}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors"
          >
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const NotificationSettings = () => {
  return (
    <Card title="Notification Settings">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Email Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>New user registrations</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>New content uploads</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Study plan updates</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>System alerts</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Dashboard Notifications</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>User activity updates</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Content engagement metrics</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Weekly summary reports</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Notification Frequency</h3>
          <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
            <option value="immediate">Immediate</option>
            <option value="hourly">Hourly Digest</option>
            <option value="daily">Daily Digest</option>
            <option value="weekly">Weekly Digest</option>
          </select>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const SecuritySettings = () => {
  return (
    <Card title="Security Settings" subtitle="Administrator access required">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Password Policy</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require strong passwords (min. 8 characters with uppercase, number, symbol)</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Force password reset every 90 days</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Prevent password reuse (last 5 passwords)</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Two-Factor Authentication</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require 2FA for admin accounts</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow SMS verification</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow authenticator apps</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Session Management</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Auto-logout after inactivity (minutes)</label>
              <input
                type="number"
                defaultValue="30"
                min="5"
                max="240"
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow multiple concurrent sessions</span>
              <input
                type="checkbox"
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Login Attempts</h3>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max failed login attempts before lockout</label>
              <input
                type="number"
                defaultValue="5"
                min="3"
                max="10"
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Account lockout duration (minutes)</label>
              <input
                type="number"
                defaultValue="15"
                min="5"
                max="60"
                className="w-32 bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

const UsersPermissionsSettings = () => {
  const [requireApproval, setRequireApproval] = useState(true);

  return (
    <Card title="Users & Permissions Settings" subtitle="Administrator access required">
      <div className="space-y-6">
        <div>
          <h3 className="text-white font-medium mb-3">Role Management</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-background-800">
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Role</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Dashboard</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Users</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Content</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Study Plans</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Analytics</th>
                  <th className="p-3 text-xs uppercase text-gray-400 font-medium">Settings</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Admin</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Teacher</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
                <tr className="border-b border-background-800">
                  <td className="p-3 text-white">Student</td>
                  <td className="p-3"><input type="checkbox" defaultChecked className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                  <td className="p-3"><input type="checkbox" className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded" /></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Custom Role</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role Name</label>
              <input
                type="text"
                placeholder="E.g., Content Manager"
                className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            
            <div>
              <label className="block text-sm text-gray-400 mb-1">Base Permissions On</label>
              <select className="w-full bg-background-800 text-white rounded py-2 px-3 focus:outline-none focus:ring-2 focus:ring-primary-500">
                <option value="">Select a role</option>
                <option value="admin">Admin</option>
                <option value="teacher">Teacher</option>
                <option value="student">Student</option>
              </select>
            </div>
          </div>
          
          <div className="mt-4">
            <button className="bg-primary-600 hover:bg-primary-700 text-white py-1.5 px-3 rounded text-sm transition-colors">
              Add Custom Role
            </button>
          </div>
        </div>
        
        <div>
          <h3 className="text-white font-medium mb-3">Registration Settings</h3>
          <div className="space-y-3">
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Allow public registration</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <span>Require email verification</span>
              <input
                type="checkbox"
                defaultChecked
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            <label className="flex items-center justify-between text-gray-300 cursor-pointer">
              <div>
                <span>Require admin approval for new accounts</span>
                <p className="text-xs text-gray-400 mt-1">
                  When enabled, new user registrations will be pending until approved by an admin
                </p>
              </div>
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                className="h-5 w-5 text-primary-600 focus:ring-primary-500 border-gray-700 bg-background-800 rounded"
              />
            </label>
            
            {requireApproval && (
              <div className="ml-6 p-3 bg-primary-900/20 border border-primary-500/30 rounded-lg">
                <p className="text-sm text-primary-300 font-medium">Admin Approval Enabled</p>
                <p className="text-xs text-gray-400 mt-1">
                  New users will be created with "pending" status and cannot sign in until approved by an admin.
                  Admins will see pending users in the "Manage Users" section.
                </p>
              </div>
            )}
          </div>
        </div>
        
        <div className="flex justify-end">
          <button className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-2 px-4 rounded transition-colors">
            <Save size={18} />
            <span>Save Settings</span>
          </button>
        </div>
      </div>
    </Card>
  );
};

export default Settings;
