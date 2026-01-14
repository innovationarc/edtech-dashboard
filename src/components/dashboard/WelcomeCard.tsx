interface WelcomeCardProps {
  userName: string;
}

const WelcomeCard = ({ userName }: WelcomeCardProps) => {
  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="relative h-48 bg-gradient-to-r from-primary-900 to-secondary-900">
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-r from-primary-800/70 to-secondary-900/50"></div>
          <img 
            src="https://images.pexels.com/photos/4050332/pexels-photo-4050332.jpeg?auto=compress&cs=tinysrgb&w=1260&h=750&dpr=1" 
            alt="Background" 
            className="w-full h-full object-cover opacity-40"
          />
        </div>

        <div className="relative p-6 text-white h-full flex flex-col justify-end">
          <div className="mb-2">Welcome back,</div>
          <h2 className="text-2xl font-bold mb-1">{userName}</h2>
          <p className="text-sm opacity-80">Glad to see you again!</p>
          <p className="text-sm opacity-60 mt-1">Manage your platform...</p>
          
          <a 
            href="#" 
            className="inline-flex items-center mt-4 text-sm bg-primary-600 hover:bg-primary-700 transition-colors py-2 px-4 rounded-lg w-max"
          >
            View Analytics
            <span className="ml-1">→</span>
          </a>
        </div>
      </div>
    </div>
  );
};

export default WelcomeCard;