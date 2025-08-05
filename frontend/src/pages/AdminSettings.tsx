import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Badge } from 'react-bootstrap';
import { settingsAPI } from '../services/api';
import { FaCog, FaSave, FaUndo, FaInfoCircle } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface AdminSettings {
  _id?: string;
  ratePerLike: number;
  ratePer100Views: number;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: {
    name: string;
  };
  updatedBy?: {
    name: string;
  };
}

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<AdminSettings>({
    ratePerLike: 0.01,
    ratePer100Views: 0.50
  });
  const [originalSettings, setOriginalSettings] = useState<AdminSettings>({
    ratePerLike: 0.01,
    ratePer100Views: 0.50
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  useEffect(() => {
    const changed = 
      settings.ratePerLike !== originalSettings.ratePerLike ||
      settings.ratePer100Views !== originalSettings.ratePer100Views;
    setHasChanges(changed);
  }, [settings, originalSettings]);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await settingsAPI.getAdminSettings();
      
      if (response.data.success) {
        const currentSettings = response.data.settings;
        setSettings(currentSettings);
        setOriginalSettings(currentSettings);
      }
    } catch (error: any) {
      console.error('Error loading admin settings:', error);
      toast.error('Failed to load admin settings: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (field: keyof AdminSettings, value: string) => {
    const numValue = parseFloat(value) || 0;
    setSettings(prev => ({
      ...prev,
      [field]: numValue
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      if (settings.ratePerLike < 0 || settings.ratePer100Views < 0) {
        toast.error('Rates cannot be negative');
        return;
      }

      const updateData = {
        ratePerLike: settings.ratePerLike,
        ratePer100Views: settings.ratePer100Views
      };

      const response = await settingsAPI.updateAdminSettings(updateData);

      if (response.data.success) {
        toast.success('Settings updated successfully!');
        setOriginalSettings(settings);
        setHasChanges(false);
      }
    } catch (error: any) {
      console.error('Error updating admin settings:', error);
      console.error('Error response:', error.response?.data);
      toast.error('Failed to update settings: ' + (error.response?.data?.message || error.message));
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setSettings(originalSettings);
    setHasChanges(false);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <Row className="justify-content-center">
          <Col md={8}>
            <Card>
              <Card.Body className="text-center">
                <div className="spinner-border text-primary" role="status">
                  <span className="visually-hidden">Loading...</span>
                </div>
                <p className="mt-3">Loading admin settings...</p>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row className="justify-content-center">
        <Col lg={10}>
          <Card className="shadow-lg">
            <Card.Header className="bg-primary text-white">
              <div className="d-flex align-items-center">
                <FaCog className="me-2" />
                <h4 className="mb-0">Admin Settings</h4>
                <Badge bg="light" text="dark" className="ms-auto">
                  Rate Management
                </Badge>
              </div>
            </Card.Header>
            
            <Card.Body>
              <Alert variant="info" className="mb-4">
                <FaInfoCircle className="me-2" />
                <strong>Rate Configuration:</strong> These settings control how earnings are calculated for content creators. 
                Changes will affect all future claims and calculations.
              </Alert>

              <Row>
                <Col md={6}>
                  <Card className="h-100 border-primary">
                    <Card.Header className="bg-light">
                      <h5 className="mb-0">
                        <FaCog className="me-2 text-primary" />
                        Rate Per Like
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <Form.Group>
                        <Form.Label>
                          <strong>Earnings per Like</strong>
                        </Form.Label>
                        <Form.Control
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.ratePerLike}
                          onChange={(e) => handleInputChange('ratePerLike', e.target.value)}
                          className="form-control-lg"
                        />
                        <Form.Text className="text-muted">
                          Current: {formatCurrency(settings.ratePerLike)} per like
                        </Form.Text>
                      </Form.Group>
                      
                      <div className="mt-3">
                        <small className="text-muted">
                          <strong>Example:</strong> If a post gets 100 likes, 
                          the creator earns {formatCurrency(settings.ratePerLike * 100)}
                        </small>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>

                <Col md={6}>
                  <Card className="h-100 border-success">
                    <Card.Header className="bg-light">
                      <h5 className="mb-0">
                        <FaCog className="me-2 text-success" />
                        Rate Per 100 Views
                      </h5>
                    </Card.Header>
                    <Card.Body>
                      <Form.Group>
                        <Form.Label>
                          <strong>Earnings per 100 Views</strong>
                        </Form.Label>
                        <Form.Control
                          type="number"
                          step="0.01"
                          min="0"
                          value={settings.ratePer100Views}
                          onChange={(e) => handleInputChange('ratePer100Views', e.target.value)}
                          className="form-control-lg"
                        />
                        <Form.Text className="text-muted">
                          Current: {formatCurrency(settings.ratePer100Views)} per 100 views
                        </Form.Text>
                      </Form.Group>
                      
                      <div className="mt-3">
                        <small className="text-muted">
                          <strong>Example:</strong> If a post gets 1000 views, 
                          the creator earns {formatCurrency((settings.ratePer100Views * 1000) / 100)}
                        </small>
                      </div>
                    </Card.Body>
                  </Card>
                </Col>
              </Row>





              <Row className="mt-4">
                <Col className="d-flex justify-content-end gap-2">
                  <Button
                    variant="outline-secondary"
                    onClick={handleReset}
                    disabled={!hasChanges || saving}
                  >
                    <FaUndo className="me-2" />
                    Reset Changes
                  </Button>
                  <Button
                    variant="primary"
                    onClick={handleSave}
                    disabled={!hasChanges || saving}
                  >
                    {saving ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Saving...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" />
                        Save Changes
                      </>
                    )}
                  </Button>
                </Col>
              </Row>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default AdminSettings; 