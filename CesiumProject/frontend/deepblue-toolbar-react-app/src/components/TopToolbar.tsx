import React from 'react';
import './TopToolbar.css';

const TopToolbar: React.FC = () => {
  const handleLoadData = () => {
    // Logic to load data goes here
  };

  return (
    <div className="top-toolbar">
      <button className="load-data-button" onClick={handleLoadData}>
        Load Data
      </button>
    </div>
  );
};

export default TopToolbar;