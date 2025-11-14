import { useState, useEffect, useCallback } from 'react';
import { Button, Panel, Typography, Container } from '@maxhub/max-ui';
import './CollectionScreen.css';
import apiClient from '../api/apiClient';
import { triggerHapticNotification } from '../utils/hapticFeedback';

function PermissionsScreen({ onNavigate, photos, onEditPermission }) {
  const [permissions, setPermissions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadPermissions = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await apiClient.getMyPermissions();
      setPermissions(data || []);
    } catch (err) {
      console.error('Failed to load permissions:', err);
      setError('Не удалось загрузить разрешения');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
  }, [loadPermissions]);

  const handleRevokePermission = async (requestId) => {
    if (!confirm('Вы уверены, что хотите отозвать это разрешение?')) {
      return;
    }

    try {
      await apiClient.revokePermission(requestId);
      triggerHapticNotification('success');
      await loadPermissions(); // Перезагрузить список
    } catch (err) {
      console.error('Failed to revoke permission:', err);
      alert('Не удалось отозвать разрешение');
    }
  };

  const handleEditPermission = (permission) => {
    // Проверить, что разрешение действительно активно
    if (!permission || !permission.request_id) {
      alert('Ошибка: неверные данные разрешения');
      return;
    }
    // Открыть экран выбора фото для редактирования разрешения
    onEditPermission(permission);
  };

  if (isLoading) {
    return (
      <div className="collection-screen">
        <Panel mode="primary" className="collection-header">
          <Container>
            <div className="header-content">
              <button className="icon-btn" onClick={() => onNavigate('collection')}>
                🔙
              </button>
              <Typography.Title level={2} className="header-title">
                Мои разрешения
              </Typography.Title>
            </div>
          </Container>
        </Panel>
        <div className="empty-container">
          <Typography.Body>Загрузка...</Typography.Body>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collection-screen">
        <Panel mode="primary" className="collection-header">
          <Container>
            <div className="header-content">
              <button className="icon-btn" onClick={() => onNavigate('collection')}>
                🔙
              </button>
              <Typography.Title level={2} className="header-title">
                Мои разрешения
              </Typography.Title>
            </div>
          </Container>
        </Panel>
        <div className="empty-container">
          <Typography.Body>{error}</Typography.Body>
          <Button onClick={loadPermissions}>Попробовать снова</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="collection-screen">
      <Panel mode="primary" className="collection-header">
        <Container>
          <div className="header-content">
            <button className="icon-btn" onClick={() => onNavigate('collection')}>
              🔙
            </button>
            <Typography.Title level={2} className="header-title">
              Мои разрешения
            </Typography.Title>
          </div>
        </Container>
      </Panel>

      {permissions.length === 0 ? (
        <div className="empty-container">
          <Typography.Body>У вас нет активных разрешений</Typography.Body>
        </div>
      ) : (
        <div style={{ padding: '16px', paddingBottom: '80px' }}>
          {permissions.map((permission) => {
            const requester = permission.requester;
            const requesterName = `${requester.first_name || ''} ${requester.last_name || ''}`.trim() || requester.username || `Пользователь ${requester.id}`;
            
            return (
              <Panel key={permission.request_id} mode="secondary" style={{ marginBottom: '16px', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '12px' }}>
                  {requester.photo_url && (
                    <img
                      src={requester.photo_url}
                      alt=""
                      style={{
                        width: '48px',
                        height: '48px',
                        borderRadius: '50%',
                        marginRight: '12px',
                        objectFit: 'cover'
                      }}
                    />
                  )}
                  <div style={{ flex: 1 }}>
                    <Typography.Title level={4}>{requesterName}</Typography.Title>
                    {requester.username && (
                      <Typography.Body size="s" style={{ color: '#666' }}>
                        @{requester.username}
                      </Typography.Body>
                    )}
                  </div>
                </div>

                <div style={{ marginBottom: '12px' }}>
                  <Typography.Body size="s" style={{ color: '#666', marginBottom: '8px' }}>
                    Разрешено просматривать: {permission.photos?.length || 0} {permission.photos?.length === 1 ? 'фото' : 'фотографий'}
                  </Typography.Body>
                  
                  {permission.photos && permission.photos.length > 0 && (
                    <div className="photo-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: '8px' }}>
                      {permission.photos.slice(0, 6).map((photo) => (
                        <div key={photo.id} className="photo-item" style={{ aspectRatio: '1', padding: 0 }}>
                          <img src={photo.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                      {permission.photos.length > 6 && (
                        <div className="photo-item" style={{ aspectRatio: '1', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
                          <Typography.Body size="s">+{permission.photos.length - 6}</Typography.Body>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <Button
                    mode="secondary"
                    onClick={() => handleEditPermission({
                      ...permission,
                      selected_photo_ids: permission.photos?.map(p => p.id) || []
                    })}
                    style={{ flex: 1 }}
                  >
                    Добавить фото
                  </Button>
                  <Button
                    mode="tertiary"
                    onClick={() => handleRevokePermission(permission.request_id)}
                    style={{ flex: 1 }}
                  >
                    Отозвать
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default PermissionsScreen;
