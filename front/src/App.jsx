import { useState, useEffect, useRef, useCallback } from 'react';
import { MaxUI, Typography, Button, Panel, Container } from '@maxhub/max-ui';
import '@maxhub/max-ui/dist/styles.css';
import WelcomeScreen from './screens/WelcomeScreen';
import CollectionScreen from './screens/CollectionScreen';
import ViewingScreen from './screens/ViewingScreen';
import ApprovalScreen from './screens/ApprovalScreen';
import PhotoSelectionScreen from './screens/PhotoSelectionScreen';
import LoaderScreen from './screens/LoaderScreen';
import ProfileViewScreen from './screens/ProfileViewScreen';
import PermissionsScreen from './screens/PermissionsScreen';
import PublicFeedScreen from './screens/PublicFeedScreen';
import apiClient from './api/apiClient';
import { triggerHapticNotification, triggerHapticImpact } from './utils/hapticFeedback';
import './App.css';

if (typeof window !== 'undefined' && import.meta.env.DEV) {
  try {
    import('eruda').then((eruda) => {
      eruda.default.init({
        tool: ['console','network','resources']
      });
    }).catch(() => {});
  } catch (e) {}
}


function App() {
  const [currentScreen, setCurrentScreen] = useState('collection');
  const [photos, setPhotos] = useState([]);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewingPhotoId, setViewingPhotoId] = useState(null);
  const [incomingTransferRequest, setIncomingTransferRequest] = useState(null);
  const [showTransferConfirmationModal, setShowTransferConfirmationModal] = useState(false);
  const [scannedTrades, setScannedTrades] = useState([]);
  const [pendingProfileRequests, setPendingProfileRequests] = useState([]);
  const [currentProfileRequest, setCurrentProfileRequest] = useState(null);
  const [approvedPhotosData, setApprovedPhotosData] = useState(null);
  const [viewedProfileUserId, setViewedProfileUserId] = useState(null);
  const [viewedProfileUserInfo, setViewedProfileUserInfo] = useState(null);
  const [profileRefreshTrigger, setProfileRefreshTrigger] = useState(0);
  const [viewingProfileUserId, setViewingProfileUserId] = useState(null);
  const [editingPermission, setEditingPermission] = useState(null);
  const [favoritePhotoIds, setFavoritePhotoIds] = useState(new Set());

  const ws = useRef(null);

  const loadPendingProfileRequests = useCallback(async () => {
    try {
      const requests = await apiClient.getPendingProfileRequests();
      setPendingProfileRequests(requests || []);
    } catch (error) {
      setPendingProfileRequests([]);
    }
  }, []);

  useEffect(() => {
    const checkAuth = async () => {
      if (apiClient.isLoggedIn()) {
        try {
          const serverPhotos = await apiClient.getPhotos();
          setPhotos(serverPhotos);
          setIsAuthenticated(true);
          loadPendingProfileRequests();
        } catch (error) {
          console.error("Failed to fetch photos:", error);
          apiClient.logout();
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };
    checkAuth();
  }, [loadPendingProfileRequests]);

  const handleWebSocketMessage = useCallback((event) => {
    let message;
    try {
      message = JSON.parse(event.data);
    } catch (error) {
      console.error("Failed to parse WebSocket message:", error, event.data);
      return;
    }

    if (message.type === "materials_updated") {
      apiClient.getPhotos().then(setPhotos);
      apiClient.getFavoriteIds().then(ids => setFavoritePhotoIds(new Set(ids || [])));
      setProfileRefreshTrigger(prev => prev + 1);
    } else if (message.type === "profile_view_request") {
      loadPendingProfileRequests();
      triggerHapticNotification('warning');
      if (window.WebApp && window.WebApp.showPopup) {
        window.WebApp.showPopup({
          title: "Запрос на просмотр профиля",
          message: message.message,
          buttons: [{id: "view", type: "default", text: "Посмотреть"}, {type: "cancel"}]
        }, (buttonId) => {
          if (buttonId === "view") {
            navigateToScreen('collection');
          }
        });
      }
    } else if (message.type === "profile_view_approved") {
      if (message.target_id && typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
        try {
          const storageKey = `approved_profile_${message.target_id}`;
          localStorage.setItem(storageKey, JSON.stringify({
            approved: true,
            timestamp: Date.now(),
            request_id: message.request_id
          }));
        } catch (e) {
          // Ignore localStorage errors
        }
      }
      
      if (message.is_update || (message.old_photo_ids && message.old_photo_ids.length > 0)) {
        if (viewedProfileUserId === message.target_id) {
          setProfileRefreshTrigger(prev => prev + 1);
        }
        const oldPhotoIds = new Set(message.old_photo_ids || []);
        const newPhotoIds = new Set(message.photo_ids || []);
        const addedPhotos = [...newPhotoIds].filter(id => !oldPhotoIds.has(id));
        const removedPhotos = [...oldPhotoIds].filter(id => !newPhotoIds.has(id));
        
        const userName = message.target_user_name || 'Пользователь';
        let notificationMessage = '';
        let notificationTitle = 'Разрешение обновлено';
        
        if (removedPhotos.length > 0 && addedPhotos.length === 0 && totalNew === 0) {
          // Все фото отозваны
          notificationTitle = 'Доступ отозван';
          notificationMessage = `${userName} закрыл доступ к просмотру фото`;
        } else if (removedPhotos.length > 0 && totalNew === 0) {
          // Все фото отозваны
          notificationTitle = 'Доступ отозван';
          notificationMessage = `${userName} закрыл доступ к просмотру фото`;
        } else if (removedPhotos.length > 0 && addedPhotos.length === 0) {
          // Часть фото отозвана
          notificationTitle = 'Доступ ограничен';
          notificationMessage = `${userName} отозвал право на просмотр части фото`;
        } else if (addedPhotos.length > 0 && removedPhotos.length === 0) {
          // Добавлены новые фото
          notificationTitle = 'Доступ расширен';
          notificationMessage = `${userName} расширил доступ к просмотру фото`;
        } else if (addedPhotos.length > 0 && removedPhotos.length > 0) {
          // И добавлены, и удалены фото
          notificationTitle = 'Разрешение изменено';
          notificationMessage = `${userName} изменил разрешение на просмотр фото`;
        } else {
          // Количество не изменилось, но список мог измениться
          notificationTitle = 'Разрешение обновлено';
          notificationMessage = `${userName} обновил разрешение на просмотр фото`;
        }
        
        // Обновить данные о фотографиях
        if (message.request_id) {
          apiClient.getApprovedPhotos(message.request_id)
            .then((approvedPhotos) => {
              if (approvedPhotos && approvedPhotos.length > 0) {
                setApprovedPhotosData({
                  targetId: message.target_id,
                  requestId: message.request_id,
                  photoIds: message.photo_ids,
                  photos: approvedPhotos
                });
              } else {
                // Если фото больше нет - очистить данные
                setApprovedPhotosData(null);
              }
            })
            .catch((error) => {
              console.error("Failed to load approved photos:", error);
            });
        }
        
        if (window.WebApp && window.WebApp.showPopup) {
          window.WebApp.showPopup({
            title: notificationTitle,
            message: notificationMessage,
            buttons: [{type: "ok"}]
          });
        } else {
          alert(`${notificationTitle}\n${notificationMessage}`);
        }
        triggerHapticNotification('success');
      } else {
        if (viewedProfileUserId === message.target_id) {
          setProfileRefreshTrigger(prev => prev + 1);
        }
        
        if (message.request_id) {
          apiClient.getApprovedPhotos(message.request_id)
            .then((approvedPhotos) => {
              if (approvedPhotos && approvedPhotos.length > 0) {
                // Сохранить данные о фотографиях
                setApprovedPhotosData({
                  targetId: message.target_id,
                  requestId: message.request_id,
                  photoIds: message.photo_ids,
                  photos: approvedPhotos
                });
              }
            })
            .catch((error) => {
              console.error("Failed to load approved photos:", error);
            });
        }
        
        const userName = message.target_user_name || 'Пользователь';
        if (window.WebApp && window.WebApp.showPopup) {
          window.WebApp.showPopup({
            title: "Запрос одобрен!",
            message: `${userName} поделился фото`,
            buttons: [{type: "ok"}]
          });
        } else {
          alert(`Запрос одобрен!\n${userName} поделился фото`);
        }
        triggerHapticNotification('success');
      }
    } else if (message.type === "profile_view_rejected") {
      
      const isViewingProfile = currentScreen === 'profile_view' && message.target_id && viewedProfileUserId === message.target_id;
      const isViewingPhotos = currentScreen === 'viewing' && message.target_id && viewingProfileUserId === message.target_id;
      
      if (isViewingProfile) {
        setViewedProfileUserId(null);
        setViewedProfileUserInfo(null);
        setApprovedPhotosData(null);
        setProfileRefreshTrigger(0);
        
        // Очистить localStorage для этого пользователя
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          try {
            const storageKey = `approved_profile_${message.target_id}`;
            localStorage.removeItem(storageKey);
          } catch (e) {
            console.warn('Failed to clear localStorage:', e);
          }
        }
        
        setCurrentScreen('collection');
      }
      
      if (isViewingPhotos) {
        setViewingProfileUserId(null);
        setApprovedPhotosData(null);
        setCurrentScreen('collection');
      }
      
      if (message.target_id) {
        if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
          try {
            const storageKey = `approved_profile_${message.target_id}`;
            localStorage.removeItem(storageKey);
          } catch (e) {
            console.warn('Failed to clear localStorage:', e);
          }
        }
        
        if (viewedProfileUserId === message.target_id) {
          setViewedProfileUserId(null);
          setViewedProfileUserInfo(null);
          setApprovedPhotosData(null);
          setProfileRefreshTrigger(0);
        }
        
        // Очистить данные о просматриваемых фотографиях, если они есть
        if (viewingProfileUserId === message.target_id) {
          setViewingProfileUserId(null);
          setApprovedPhotosData(null);
        }
      }
      
      // Показывать уведомление только если пользователь просматривал профиль или фотографии
      if ((isViewingProfile || isViewingPhotos) && window.WebApp && window.WebApp.showPopup) {
        const userName = message.target_user_name || 'Пользователь';
        window.WebApp.showPopup({
          title: "Доступ отозван",
          message: `${userName} закрыл доступ к просмотру фото`,
          buttons: [{type: "ok"}]
        });
      }
    } else if (message.type === "transfer_completed") {
      if (window.WebApp && window.WebApp.showPopup) {
        window.WebApp.showPopup({
          title: "Фото получено!",
          message: message.message,
          buttons: [{type: "ok"}]
        });
      } else {
        alert(message.message);
      }

      apiClient.getPhotos().then(setPhotos);

      triggerHapticNotification('success');
    } else if (message.type === "transfer_request") {
      setIncomingTransferRequest(message);
      setShowTransferConfirmationModal(true);
      triggerHapticNotification('warning');
    } else if (message.type === "transfer_status") {
      if (message.status === "accepted") {
        alert(message.message);
        apiClient.getPhotos().then(setPhotos);
      } else {
        alert(message.message);
      }
      triggerHapticNotification('success');
    }
  }, [loadPendingProfileRequests, viewedProfileUserId, currentScreen, viewingProfileUserId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      try {
        setIncomingTransferRequest(null);
        setShowTransferConfirmationModal(false);
        setPendingProfileRequests([]);
        setCurrentProfileRequest(null);
        setScannedTrades([]);
        
      } catch (error) {
        console.error('Error clearing pending requests:', error);
      }
    }, 100);

    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    if (isAuthenticated && photos.length > 0 && favoritePhotoIds.size === 0) {
      apiClient.getFavoriteIds()
        .then(ids => {
          setFavoritePhotoIds(new Set(ids || []));
        })
        .catch(error => {
          console.error('Failed to load favorites on init:', error);
        });
    }
  }, [isAuthenticated, photos.length]);

  // Notify MAX that the app is ready
  useEffect(() => {
    if (window.WebApp && typeof window.WebApp.ready === 'function') {
      window.WebApp.ready();
    }
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !window.WebApp || !window.WebApp.initDataUnsafe?.user?.id) {
      return;
    }

    const userId = window.WebApp.initDataUnsafe.user.id;
    const wsBaseUrl = import.meta.env.VITE_WS_URL || 'wss://api.whitea.cloud/ws';
    const wsUrl = `${wsBaseUrl}/connect?user_id=${userId}`;
    let reconnectAttempts = 0;
    const maxReconnectAttempts = 5;
    const reconnectDelay = 3000; // 3 seconds
    let reconnectTimeoutId = null;
    let isMounted = true;
    let connectionStartTime = null;

    const connectWebSocket = () => {
      if (!isMounted) return;

      connectionStartTime = Date.now();

      try {
        ws.current = new WebSocket(wsUrl);

        ws.current.onopen = () => {
          reconnectAttempts = 0;
        };

        ws.current.onmessage = handleWebSocketMessage;

        ws.current.onclose = (event) => {
          const connectionDuration = connectionStartTime ? Date.now() - connectionStartTime : 0;
          
          if (isMounted && event.code !== 1000 && reconnectAttempts < maxReconnectAttempts) {
            reconnectAttempts++;
            const delay = reconnectDelay;
            reconnectTimeoutId = setTimeout(() => {
              connectWebSocket();
            }, delay);
          } else if (reconnectAttempts >= maxReconnectAttempts) {
            console.error(`[WebSocket] Max reconnection attempts (${maxReconnectAttempts}) reached. Connection failed.`);
            console.error(`[WebSocket] Last error: Code ${event.code}, Reason: ${event.reason || 'Unknown'}`);
            console.error(`[WebSocket] Possible causes:`);
            console.error(`  - WebSocket server is not running or not accessible`);
            console.error(`  - Network connectivity issues`);
            console.error(`  - SSL/TLS certificate problems`);
            console.error(`  - Proxy/load balancer configuration issues`);
          }
        };

        ws.current.onerror = (error) => {
          console.error("[WebSocket] Error occurred:", error);
          console.error(`[WebSocket] ReadyState: ${ws.current?.readyState}`);
          console.error(`[WebSocket] URL: ${wsUrl}`);
        };
      } catch (error) {
        console.error("[WebSocket] Failed to create WebSocket connection:", error);
        console.error(`[WebSocket] Error details:`, error.message, error.stack);
        if (isMounted && reconnectAttempts < maxReconnectAttempts) {
          reconnectAttempts++;
          reconnectTimeoutId = setTimeout(() => {
            connectWebSocket();
          }, reconnectDelay);
        }
      }
    };

    const checkServerAndConnect = async () => {
      try {
        const healthResponse = await fetch(`${import.meta.env.VITE_API_URL || 'https://api.whitea.cloud'}/health`);
        if (healthResponse.ok) {
          connectWebSocket();
        } else {
          console.warn('[WebSocket] Server health check failed, will still attempt WebSocket connection');
          connectWebSocket();
        }
      } catch (error) {
        console.warn('[WebSocket] Could not verify server availability:', error);
        connectWebSocket();
      }
    };

    const initialTimeout = setTimeout(() => {
      checkServerAndConnect();
    }, 500);

    return () => {
      isMounted = false;
      if (initialTimeout) {
        clearTimeout(initialTimeout);
      }
      if (reconnectTimeoutId) {
        clearTimeout(reconnectTimeoutId);
      }
      if (ws.current) {
        if (ws.current.readyState === WebSocket.OPEN || ws.current.readyState === WebSocket.CONNECTING) {
          ws.current.close(1000, "Component unmount");
        }
      }
    };
  }, [isAuthenticated, handleWebSocketMessage]);


  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await apiClient.login(window.WebApp.initData);
      setIsAuthenticated(true);
      const serverPhotos = await apiClient.getPhotos();
      setPhotos(serverPhotos);
      
      try {
        const favIds = await apiClient.getFavoriteIds();
        setFavoritePhotoIds(new Set(favIds || []));
      } catch (error) {
        console.error('Failed to load favorites:', error);
        setFavoritePhotoIds(new Set());
      }
    } catch (error) {
      console.error("Failed to login:", error);
      setIsAuthenticated(false); 
    }
    setIsLoading(false);
  };

  const handleLogout = () => {
    apiClient.logout();
    setIsAuthenticated(false);
    setPhotos([]);
    setFavoritePhotoIds(new Set());
    setCurrentScreen('collection');
  };

  const handleFavoriteToggle = async (photoId) => {
    const isFavorite = favoritePhotoIds.has(photoId);
    
    try {
      if (isFavorite) {
        await apiClient.removeFavorite(photoId);
        setFavoritePhotoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(photoId);
          return newSet;
        });
      } else {
        await apiClient.addFavorite(photoId);
        setFavoritePhotoIds(prev => {
          const newSet = new Set([...prev, photoId]);
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      
      if (error.message && error.message.includes('already in favorites')) {
        try {
          const favIds = await apiClient.getFavoriteIds();
          setFavoritePhotoIds(new Set(favIds || []));
        } catch (reloadError) {
          console.error('Failed to reload favorites:', reloadError);
        }
      } else if (error.message && error.message.includes('not in favorites')) {
        setFavoritePhotoIds(prev => {
          const newSet = new Set(prev);
          newSet.delete(photoId);
          return newSet;
        });
      }
      else {
        alert(error.message || 'Не удалось обновить избранное');
      }
    }
  };

  const handleAddPhotos = async (filesOrPhotos) => {
    if (filesOrPhotos.length > 0 && filesOrPhotos[0].id !== undefined) {

      setPhotos(prevPhotos => [...filesOrPhotos, ...prevPhotos]);
      return;
    }
    
    const formData = new FormData();
    filesOrPhotos.forEach(file => {
      formData.append('files', file);
    });

    try {
      const newPhotos = await apiClient.uploadPhotos(formData);
      setPhotos(prevPhotos => [...newPhotos, ...prevPhotos]);
    } catch (error) {
      console.error("Failed to upload photos:", error);
      alert("Ошибка загрузки. Пожалуйста, попробуйте еще раз.");
    }
  };

  const handleDeletePhotos = async (photoIds) => {
    try {
      // Разделить фото на собственные и импортированные
      const photosToDelete = photos.filter(p => photoIds.includes(p.id));
      const ownedPhotoIds = photosToDelete.filter(p => !p.is_imported).map(p => p.id);
      const importedPhotoIds = photosToDelete.filter(p => p.is_imported).map(p => p.id);
      
      // Удалить импортированные фото (только удаляет ссылку, не оригинал)
      if (importedPhotoIds.length > 0) {
        for (const photoId of importedPhotoIds) {
          await apiClient.removeImportedPhoto(photoId);
        }
        setPhotos(prevPhotos => prevPhotos.filter(p => !importedPhotoIds.includes(p.id)));
      }
      
      // Удалить собственные фото (с проверкой использования)
      if (ownedPhotoIds.length > 0) {
        // Проверить, используются ли фотографии в активных запросах или разрешениях
        const usageCheck = await apiClient.checkPhotoUsage(ownedPhotoIds);
        
        if (usageCheck.used_photos && usageCheck.used_photos.length > 0) {
          // Составить сообщение о том, где используются фото
          const usageMessages = [];
          usageCheck.used_photos.forEach(photo => {
            const parts = [];
            if (photo.in_profile_requests) {
              parts.push(`в ${photo.profile_requests_count} ${photo.profile_requests_count === 1 ? 'разрешении на просмотр' : 'разрешениях на просмотр'}`);
            }
            if (photo.in_trades) {
              parts.push(`в ${photo.trades_count} ${photo.trades_count === 1 ? 'активном трейде' : 'активных трейдах'}`);
            }
            if (photo.in_transfers) {
              parts.push(`в ${photo.transfers_count} ${photo.transfers_count === 1 ? 'запросе на передачу' : 'запросах на передачу'}`);
            }
            if (parts.length > 0) {
              usageMessages.push(`Фото используется ${parts.join(', ')}`);
            }
          });
          
          const message = `Внимание! Выбранные фотографии используются в активных заявках или разрешениях:\n\n${usageMessages.join('\n')}\n\nВы уверены, что хотите удалить их? Это удалит фото у всех, кто его импортировал.`;
          
          // Показать предупреждение
          let shouldDelete = false;
          if (window.WebApp && window.WebApp.showPopup) {
            await new Promise((resolve) => {
              window.WebApp.showPopup({
                title: "Предупреждение",
                message: message.replace(/\n/g, ' '),
                buttons: [
                  {id: "confirm", type: "destructive", text: "Удалить"},
                  {id: "cancel", type: "cancel", text: "Отмена"}
                ]
              }, (buttonId) => {
                shouldDelete = buttonId === "confirm";
                resolve();
              });
            });
          } else {
            // Fallback для случаев, когда WebApp недоступен
            shouldDelete = confirm(message);
          }
          
          if (!shouldDelete) {
            return; // Пользователь отменил удаление
          }
        }
        
        // Удалить фотографии
        await apiClient.deletePhotos(ownedPhotoIds);
        setPhotos(prevPhotos => prevPhotos.filter(p => !ownedPhotoIds.includes(p.id)));
      }
      
      triggerHapticNotification('success');
    } catch (error) {
      console.error("Failed to delete photos:", error);
      if (error.message !== "Cancelled") {
        alert("Ошибка удаления. Пожалуйста, попробуйте еще раз.");
      }
    }
  };

  const deSelectPhotoSelection = (id) => {
    setPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.id === id ? { ...photo, selected: false} : photo
      )
    );
  };

  const togglePhotoSelection = (id) => {
    setPhotos(prevPhotos => 
      prevPhotos.map(photo => 
        photo.id === id ? { ...photo, selected: !photo.selected } : photo
      )
    );
  };

  const navigateToScreen = (screen, payload = null) => {
    if (screen === 'viewing' && payload) {
      if (payload.photoId) {
        setViewingPhotoId(payload.photoId);
      }
      // Если переданы одобренные фотографии, сохранить их в approvedPhotosData
      if (payload.approvedPhotos && Array.isArray(payload.approvedPhotos)) {
        setApprovedPhotosData(prev => ({
          ...prev,
          photos: payload.approvedPhotos
        }));
      }
      // Сохранить profileUserId если переходим из профиля
      if (payload.profileUserId) {
        setViewingProfileUserId(payload.profileUserId);
      } else {
        setViewingProfileUserId(null);
      }
    } else if (screen === 'profile_view' && payload && payload.userId) {
      // Загрузить информацию о пользователе
      setViewedProfileUserId(payload.userId);
      apiClient.getUserInfo(payload.userId)
        .then((userInfo) => {
          setViewedProfileUserInfo(userInfo);
        })
        .catch((error) => {
          console.error('Failed to load user info:', error);
          alert('Не удалось загрузить информацию о пользователе');
        });
    } else if (screen === 'collection') {
      // При возврате в коллекцию очистить одобренные фотографии и данные профиля
      setApprovedPhotosData(null);
      setViewedProfileUserId(null);
      setViewedProfileUserInfo(null);
      setViewingProfileUserId(null);
      setEditingPermission(null);
      setCurrentProfileRequest(null);
    } else if (screen === 'photo_selection') {
      // При переходе на экран выбора фото ничего не очищаем, так как данные уже установлены
    } else {
      // При переходе на другие экраны очищаем временные данные о запросах
      if (screen !== 'permissions' && screen !== 'photo_selection') {
        setEditingPermission(null);
        setCurrentProfileRequest(null);
      }
    }
    setCurrentScreen(screen);
  };

  const handleAcceptTransfer = async () => {
    if (!incomingTransferRequest) return;
    try {
      await apiClient.confirmTransfer(incomingTransferRequest.transfer_id, true);
      alert("Передача фотографии подтверждена.");
    } catch (error) {
      console.error("Failed to accept transfer:", error);
      alert("Ошибка при подтверждении передачи.");
    } finally {
      setIncomingTransferRequest(null);
      setShowTransferConfirmationModal(false);
    }
  };

  const handleRejectTransfer = async () => {
    if (!incomingTransferRequest) return;
    try {
      await apiClient.confirmTransfer(incomingTransferRequest.transfer_id, false);
      alert("Передача фотографии отклонена.");
    } catch (error) {
      console.error("Failed to reject transfer:", error);
      alert("Ошибка при отклонении передачи.");
    } finally {
      setIncomingTransferRequest(null);
      setShowTransferConfirmationModal(false);
    }
  };

  const loadScannedTrades = useCallback(async () => {
    try {
      // Загрузить только незавершенные трейды (pending) - они должны очищаться при перезагрузке
      // Завершенные трейды уже обработаны и фотографии добавлены в коллекцию
      const trades = await apiClient.getScannedTrades();
      // Фильтруем только pending трейды, если бэкенд не фильтрует
      const pendingTrades = (trades || []).filter(trade => trade.status === 'pending' || !trade.status);
      setScannedTrades(pendingTrades);
    } catch (error) {
      setScannedTrades([]);
    }
  }, []);

  const handleConfirmTrade = async (tradeId, accept) => {
    try {
      const response = accept
        ? await apiClient.confirmTrade(tradeId)
        : await apiClient.rejectTrade(tradeId);

      triggerHapticNotification('success');

      await loadScannedTrades();

    } catch (error) {
      console.error(`Error ${accept ? 'confirming' : 'rejecting'} trade ${tradeId}:`, error);
      alert('Ошибка при обработке трейда');
    }
  };

  const handleConfirmPhotoSelection = async (selectedPhotoIds) => {
    if (editingPermission) {
      try {
        await apiClient.updatePermissionPhotos(
          editingPermission.request_id,
          selectedPhotoIds
        );

        triggerHapticNotification('success');
        setEditingPermission(null);
        navigateToScreen('permissions');
      } catch (error) {
        console.error('Error updating permission:', error);
        
        if (error.message && (error.message.includes('not approved') || error.message.includes('rejected'))) {
          alert('Это разрешение больше не активно. Список разрешений будет обновлён.');
          setEditingPermission(null);
          navigateToScreen('permissions');
        } else {
          alert(`Ошибка при обновлении разрешения: ${error.message || 'Неизвестная ошибка'}`);
        }
      }
      return;
    }

    if (!currentProfileRequest) return;

    try {
      await apiClient.respondToProfileRequest(
        currentProfileRequest.id,
        true,
        selectedPhotoIds
      );

      triggerHapticNotification('success');

      setCurrentProfileRequest(null);
      await loadPendingProfileRequests();
      navigateToScreen('collection');

    } catch (error) {
      console.error('Error confirming photo selection:', error);
      
      // Если запрос уже был обработан, просто обновить список и вернуться назад
      if (error.message && error.message.includes('already been responded')) {
        alert('Этот запрос уже был обработан. Список запросов будет обновлён.');
        setCurrentProfileRequest(null);
        await loadPendingProfileRequests();
        navigateToScreen('collection');
      } else {
        alert(`Ошибка при подтверждении выбора: ${error.message || 'Неизвестная ошибка'}`);
      }
    }
  };

  if (isLoading) {
    return <LoaderScreen />;
  }

  const screenToShow = () => {
    if (!isAuthenticated) {
      return <WelcomeScreen photos={photos} onStart={handleLogin} />;
    }


    let screenComponent;
    switch (currentScreen) {
      case 'collection':
        screenComponent = (
          <CollectionScreen
            photos={photos}
            onToggleSelection={togglePhotoSelection}
            onAddPhoto={handleAddPhotos}
            onDeletePhotos={handleDeletePhotos}
            onNavigate={navigateToScreen}
            onLogout={handleLogout}
            ws={ws}
            scannedTrades={scannedTrades}
            loadScannedTrades={loadScannedTrades}
            pendingProfileRequests={pendingProfileRequests}
            onReloadPhotos={async () => {
              const serverPhotos = await apiClient.getPhotos();
              setPhotos(serverPhotos);
            }}
            onProfileRequestClick={async (request) => {
              // Проверим, что запрос всё ещё pending, прежде чем переходить к выбору фото
              try {
                const updatedRequests = await apiClient.getPendingProfileRequests();
                const stillPending = updatedRequests.find(r => r.id === request.id);
                
                if (stillPending) {
                  setCurrentProfileRequest(request);
                  navigateToScreen('photo_selection');
                } else {
                  // Запрос больше не pending - обновить список и показать уведомление
                  setPendingProfileRequests(updatedRequests || []);
                  alert('Этот запрос уже был обработан или истёк.');
                }
              } catch (error) {
                console.error('Error checking request status:', error);
                // В случае ошибки всё равно позволить пользователю попробовать
                setCurrentProfileRequest(request);
                navigateToScreen('photo_selection');
              }
            }}
          />
        );
        break;
      case 'viewing':
        // Использовать одобренные фотографии, если они есть, иначе обычные фотографии
        const viewingPhotos = approvedPhotosData?.photos && approvedPhotosData.photos.length > 0 
          ? approvedPhotosData.photos 
          : photos;
        screenComponent = (
          <ViewingScreen
            photos={viewingPhotos}
            viewingPhotoId={viewingPhotoId}
            onSetViewedPhoto={setViewingPhotoId}
            onNavigate={navigateToScreen}
            onDeletePhotos={handleDeletePhotos}
            profileUserId={viewingProfileUserId}
            favoritePhotoIds={favoritePhotoIds}
            onFavoriteToggle={handleFavoriteToggle}
            onRequestPhoto={async (userId) => {
              try {
                const response = await apiClient.createProfileRequest(userId);
                if (window.WebApp && window.WebApp.showPopup) {
                  window.WebApp.showPopup({
                    title: "Запрос отправлен",
                    message: "Запрос на просмотр фотографии отправлен. Ожидайте ответа.",
                    buttons: [{type: "ok"}]
                  });
                } else {
                  alert('Запрос на просмотр фотографии отправлен!');
                }
                loadPendingProfileRequests();
              } catch (error) {
                console.error('Error creating profile request:', error);
                const errorMessage = error.message || 'Ошибка при отправке запроса';
                if (window.WebApp && window.WebApp.showPopup) {
                  window.WebApp.showPopup({
                    title: "Ошибка",
                    message: errorMessage,
                    buttons: [{type: "ok"}]
                  });
                } else {
                  alert(errorMessage);
                }
              }
            }}
          />
        );
        break;
      case 'approval':
        screenComponent = (
          <ApprovalScreen
            scannedTrades={scannedTrades}
            onNavigate={navigateToScreen}
            onConfirmTrade={(tradeId) => handleConfirmTrade(tradeId, true)}
            onRejectTrade={(tradeId) => handleConfirmTrade(tradeId, false)}
          />
        );
        break;
      case 'photo_selection':
        screenComponent = (
          <PhotoSelectionScreen
            photos={photos}
            onNavigate={navigateToScreen}
            onConfirmSelection={handleConfirmPhotoSelection}
            requestInfo={currentProfileRequest}
            editingPermission={editingPermission}
          />
        );
        break;
      case 'profile_view':
        screenComponent = (
          <ProfileViewScreen
            userId={viewedProfileUserId}
            userInfo={viewedProfileUserInfo}
            onNavigate={navigateToScreen}
            refreshTrigger={profileRefreshTrigger}
            onRequestSent={() => {
              loadPendingProfileRequests();
            }}
          />
        );
        break;
      case 'permissions':
        screenComponent = (
          <PermissionsScreen
            key={`permissions-${Date.now()}`}
            onNavigate={navigateToScreen}
            photos={photos}
            onEditPermission={async (permission) => {
              try {
                const permissions = await apiClient.getMyPermissions();
                const stillActive = permissions.find(p => p.request_id === permission.request_id);
                
                if (stillActive) {
                  setEditingPermission(permission);
                  setCurrentProfileRequest({
                    id: permission.request_id,
                    first_name: permission.requester.first_name,
                    last_name: permission.requester.last_name,
                    username: permission.requester.username
                  });
                  navigateToScreen('photo_selection');
                } else {
                  alert('Это разрешение больше не активно. Список разрешений будет обновлён.');
                  navigateToScreen('permissions');
                }
              } catch (error) {
                console.error('Error checking permission status:', error);
                setEditingPermission(permission);
                setCurrentProfileRequest({
                  id: permission.request_id,
                  first_name: permission.requester.first_name,
                  last_name: permission.requester.last_name,
                  username: permission.requester.username
                });
                navigateToScreen('photo_selection');
              }
            }}
          />
        );
        break;
      case 'public_feed':
        screenComponent = (
          <PublicFeedScreen
            onNavigate={navigateToScreen}
            onReloadPhotos={async () => {
              const serverPhotos = await apiClient.getPhotos();
              setPhotos(serverPhotos);
            }}
          />
        );
        break;
      default:
        screenComponent = (
          <CollectionScreen
            photos={photos}
            onToggleSelection={togglePhotoSelection}
            onAddPhoto={handleAddPhotos}
            onDeletePhotos={handleDeletePhotos}
            onNavigate={navigateToScreen}
            onLogout={handleLogout}
            ws={ws}
            scannedTrades={scannedTrades}
            loadScannedTrades={loadScannedTrades}
            pendingProfileRequests={pendingProfileRequests}
            onProfileRequestClick={async (request) => {
              // Проверим, что запрос всё ещё pending, прежде чем переходить к выбору фото
              try {
                const updatedRequests = await apiClient.getPendingProfileRequests();
                const stillPending = updatedRequests.find(r => r.id === request.id);
                
                if (stillPending) {
                  setCurrentProfileRequest(request);
                  navigateToScreen('photo_selection');
                } else {
                  // Запрос больше не pending - обновить список и показать уведомление
                  setPendingProfileRequests(updatedRequests || []);
                  alert('Этот запрос уже был обработан или истёк.');
                }
              } catch (error) {
                console.error('Error checking request status:', error);
                // В случае ошибки всё равно позволить пользователю попробовать
                setCurrentProfileRequest(request);
                navigateToScreen('photo_selection');
              }
            }}
          />
        );
    }
    return screenComponent;
  };

  return (
    <MaxUI>
      <div className="app">
        {screenToShow()}

      {showTransferConfirmationModal && incomingTransferRequest && (
        <div className="modal-overlay" onClick={() => setShowTransferConfirmationModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <Typography.Title level={3}>Подтверждение Передачи Фото</Typography.Title>
            <p>{incomingTransferRequest.message}</p>
            <img src={incomingTransferRequest.photo_url} alt="Фото для передачи" style={{ maxWidth: '100%', height: 'auto' }} />
            <div className="modal-actions">
              <Button mode="secondary" onClick={handleRejectTransfer}>Отклонить</Button>
              <Button mode="primary" onClick={handleAcceptTransfer}>Подтвердить</Button>
            </div>
          </div>
        </div>
      )}
      </div>
    </MaxUI>
  );
}

export default App;
