import { useState } from 'react';
import { MaxUI } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import WelcomeScreen from './screens/WelcomeScreen';
import CollectionScreen from './screens/CollectionScreen';
import TradingScreen from './screens/TradingScreen';
import BonusesScreen from './screens/BonusesScreen';
import HistoryScreen from './screens/HistoryScreen';
import ViewingScreen from './screens/ViewingScreen';
import './App.css';

function App() {
  const USERID = 1;
  const [currentScreen, setCurrentScreen] = useState('welcome');
  const [photos, setPhotos] = useState([
  ]);


  const selectSinglePhoto = (id) => {
    setPhotos(prevPhotos => 
      prevPhotos.map(photo => ({
        ...photo,
        selected: photo.id === id
      }))
    );
  };

  const togglePhotoSelection = (id) => {
    setPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.id === id ? { ...photo, selected: !photo.selected } : photo
      )
    );
  };

  const addPhoto = (url) => {
    const newPhoto = {
      id: `photo-${USERID}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      url: url,
      selected: false
    };
    setPhotos(prevPhotos => [...prevPhotos, newPhoto]);
  };

  const deleteSelectedPhotos = () => {
    setPhotos(photos.filter(photo => !photo.selected));
  };

  const navigateToScreen = (screen) => {
    setCurrentScreen(screen);
  };

  return (
    <MaxUI>
      <div className="app">
        {currentScreen === 'welcome' && (
          <WelcomeScreen 
            photos={photos} 
            onStart={() => navigateToScreen('collection')} 
          />
        )}
        {currentScreen === 'collection' && (
          <CollectionScreen 
            USERID={String(USERID)}
            photos={photos}
            onToggleSelection={togglePhotoSelection}
            onAddPhoto={addPhoto}
            onDeletePhotos={deleteSelectedPhotos}
            onNavigate={navigateToScreen}
          />
        )}
        {currentScreen === 'trading' && (
          <TradingScreen onNavigate={navigateToScreen} />
        )}
        {currentScreen === 'viewing' && (
          <ViewingScreen 
            USERID={String(USERID)}
            photos={photos}
            setPhotos={setPhotos}
            onNavigate={navigateToScreen} 
            onSelectPhoto={selectSinglePhoto} 
          />
        )}
        {currentScreen === 'bonuses' && (
          <BonusesScreen onNavigate={navigateToScreen} />
        )}
        {currentScreen === 'history' && (
          <HistoryScreen onNavigate={navigateToScreen} />
        )}
      </div>
    </MaxUI>
  );
}

export default App;
