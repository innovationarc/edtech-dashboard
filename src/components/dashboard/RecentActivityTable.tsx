interface ActivityItem {
  id: string;
  type: string;
  title: string;
  description: string;
  user: string;
  timestamp: Date;
  icon: React.ReactNode;
}

interface RecentActivityTableProps {
  recentItems: ActivityItem[];
}

const RecentActivityTable = ({ recentItems }: RecentActivityTableProps) => {
  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours === 1) return '1 hour ago';
    if (diffInHours < 24) return `${diffInHours} hours ago`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays === 1) return '1 day ago';
    return `${diffInDays} days ago`;
  };

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Recent Activity</h3>
        <p className="text-sm text-gray-400">Latest platform activities</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-background-800">
              <th className="p-4 text-xs uppercase text-gray-400 font-medium">Activity</th>
              <th className="p-4 text-xs uppercase text-gray-400 font-medium">User</th>
              <th className="p-4 text-xs uppercase text-gray-400 font-medium">Time</th>
              <th className="p-4 text-xs uppercase text-gray-400 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {recentItems.map((item) => (
              <tr key={item.id} className="border-b border-background-800 last:border-0">
                <td className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-background-700 flex items-center justify-center">
                      {item.icon}
                    </div>
                    <div>
                      <div className="text-white font-medium">{item.title}</div>
                      <div className="text-sm text-gray-400 truncate max-w-xs">{item.description}</div>
                    </div>
                  </div>
                </td>
                <td className="p-4 text-gray-300">{item.user}</td>
                <td className="p-4 text-gray-300">{formatTimeAgo(item.timestamp)}</td>
                <td className="p-4">
                  <span className="px-2 py-1 bg-success-dark text-success-light rounded-full text-xs">
                    Completed
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {recentItems.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            No recent activity found.
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivityTable;