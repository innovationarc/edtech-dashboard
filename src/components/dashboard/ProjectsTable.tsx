const ProjectsTable = () => {
  const projects = [
    {
      id: 1,
      company: 'Chakra Soft UI Version',
      members: 5,
      budget: '$14,000',
      completion: 60,
    },
    {
      id: 2,
      company: 'Add Progress Track',
      members: 2,
      budget: '$3,000',
      completion: 10,
    },
    {
      id: 3,
      company: 'Fix Platform Errors',
      members: 2,
      budget: 'Not set',
      completion: 100,
    },
    {
      id: 4,
      company: 'Launch our Mobile App',
      members: 4,
      budget: '$32,000',
      completion: 100,
    },
  ];

  return (
    <div className="bg-card rounded-xl shadow-card overflow-hidden">
      <div className="p-5 border-b border-background-800">
        <h3 className="text-white font-medium">Projects</h3>
        <p className="text-sm text-gray-400">30 done this month</p>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left border-b border-background-800">
              <th className="p-5 text-xs uppercase text-gray-400 font-medium">Companies</th>
              <th className="p-5 text-xs uppercase text-gray-400 font-medium">Members</th>
              <th className="p-5 text-xs uppercase text-gray-400 font-medium">Budget</th>
              <th className="p-5 text-xs uppercase text-gray-400 font-medium">Completion</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((project) => (
              <tr key={project.id} className="border-b border-background-800 last:border-0">
                <td className="p-5">
                  <span className="text-white">{project.company}</span>
                </td>
                <td className="p-5">
                  <div className="flex -space-x-2">
                    {Array.from({ length: Math.min(project.members, 3) }).map((_, i) => (
                      <div key={i} className="h-8 w-8 rounded-full bg-primary-500 border-2 border-background-900 flex items-center justify-center">
                        <span className="text-xs text-white">U{i+1}</span>
                      </div>
                    ))}
                    {project.members > 3 && (
                      <div className="h-8 w-8 rounded-full bg-background-700 border-2 border-background-900 flex items-center justify-center">
                        <span className="text-xs text-white">+{project.members - 3}</span>
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-5">
                  <span className="text-white">{project.budget}</span>
                </td>
                <td className="p-5">
                  <div className="flex items-center">
                    <div className="w-full bg-background-800 rounded-full h-2 mr-2">
                      <div
                        className={`h-2 rounded-full ${
                          project.completion === 100
                            ? 'bg-success-DEFAULT'
                            : project.completion >= 60
                            ? 'bg-primary-500'
                            : 'bg-warning-DEFAULT'
                        }`}
                        style={{ width: `${project.completion}%` }}
                      ></div>
                    </div>
                    <span className="text-white text-sm">{project.completion}%</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProjectsTable;