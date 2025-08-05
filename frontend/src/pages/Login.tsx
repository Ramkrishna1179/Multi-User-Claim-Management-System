import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Tabs, Tab } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { userActionLogger } from '../config/logger';
import { FaUser, FaEnvelope, FaLock, FaEye, FaEyeSlash } from 'react-icons/fa';
import './Login.css';

const Login: React.FC = () => {
  const { login, register } = useAuth();
  const [activeTab, setActiveTab] = useState('login');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [loginData, setLoginData] = useState({
    email: '',
    password: ''
  });

  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'user'
  });

  useEffect(() => {
    userActionLogger.info('Login page visited', {
      url: window.location.href,
      userAgent: navigator.userAgent
    });
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    userActionLogger.info('Login attempt', { email: loginData.email });
    
    try {
     const loginRes= await login(loginData.email, loginData.password);
     return loginRes;
    } catch (error) {

       return;
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (registerData.password !== registerData.confirmPassword) {
      userActionLogger.warn('Registration failed - passwords do not match', { email: registerData.email });
      alert('Passwords do not match');
      return;
    }

    setLoading(true);
    
    userActionLogger.info('Registration attempt', { 
      email: registerData.email, 
      role: registerData.role 
    });
    
    try {
      await register(registerData.name, registerData.email, registerData.password, registerData.role);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const updateLoginData = (field: string, value: string) => {
    setLoginData(prev => ({ ...prev, [field]: value }));
  };

  const updateRegisterData = (field: string, value: string) => {
    setRegisterData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="login-page">
      <Container>
        <Row className="justify-content-center align-items-center min-vh-100">
          <Col xs={12} sm={10} md={8} lg={6} xl={5}>
            <Card className="shadow-lg border-0">
              <Card.Body className="p-5">
                <div className="text-center mb-4">
                  <div className="login-icon mb-3">
                    <i className="fas fa-coins fa-3x text-primary"></i>
                  </div>
                  <h2 className="fw-bold text-dark">Claim Management</h2>
                  <p className="text-muted">Sign in to your account or create a new one</p>
                </div>

                <Tabs
                  activeKey={activeTab}
                  onSelect={(k) => setActiveTab(k || 'login')}
                  className="mb-4"
                >
                  <Tab eventKey="login" title="Sign In">
                    <Form onSubmit={handleLogin}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaEnvelope className="me-2" />
                          Email Address
                        </Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Enter your email"
                          value={loginData.email}
                          onChange={(e) => updateLoginData('email', e.target.value)}
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label>
                          <FaLock className="me-2" />
                          Password
                        </Form.Label>
                        <div className="position-relative">
                          <Form.Control
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Enter your password"
                            value={loginData.password}
                            onChange={(e) => updateLoginData('password', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="link"
                            className="position-absolute end-0 top-0 h-100 border-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                          </Button>
                        </div>
                      </Form.Group>

                      <Button
                        type="submit"
                        variant="primary"
                        size="lg"
                        className="w-100 mb-3"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Signing In...
                          </>
                        ) : (
                          'Sign In'
                        )}
                      </Button>
                    </Form>
                  </Tab>

                  <Tab eventKey="register" title="Sign Up">
                    <Form onSubmit={handleRegister}>
                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaUser className="me-2" />
                          Full Name
                        </Form.Label>
                        <Form.Control
                          type="text"
                          placeholder="Enter your full name"
                          value={registerData.name}
                          onChange={(e) => updateRegisterData('name', e.target.value)}
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaEnvelope className="me-2" />
                          Email Address
                        </Form.Label>
                        <Form.Control
                          type="email"
                          placeholder="Enter your email"
                          value={registerData.email}
                          onChange={(e) => updateRegisterData('email', e.target.value)}
                          required
                        />
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>Role</Form.Label>
                        <Form.Select
                          value={registerData.role}
                          onChange={(e) => updateRegisterData('role', e.target.value)}
                        >
                          <option value="user">Content Creator (User)</option>
                          <option value="account">Account Reviewer</option>
                          <option value="admin">Administrator</option>
                        </Form.Select>
                        <Form.Text className="text-muted">
                          Choose your role in the system
                        </Form.Text>
                      </Form.Group>

                      <Form.Group className="mb-3">
                        <Form.Label>
                          <FaLock className="me-2" />
                          Password
                        </Form.Label>
                        <div className="position-relative">
                          <Form.Control
                            type={showPassword ? 'text' : 'password'}
                            placeholder="Create a password"
                            value={registerData.password}
                            onChange={(e) => updateRegisterData('password', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="link"
                            className="position-absolute end-0 top-0 h-100 border-0"
                            onClick={() => setShowPassword(!showPassword)}
                          >
                            {showPassword ? <FaEyeSlash /> : <FaEye />}
                          </Button>
                        </div>
                      </Form.Group>

                      <Form.Group className="mb-4">
                        <Form.Label>
                          <FaLock className="me-2" />
                          Confirm Password
                        </Form.Label>
                        <div className="position-relative">
                          <Form.Control
                            type={showConfirmPassword ? 'text' : 'password'}
                            placeholder="Confirm your password"
                            value={registerData.confirmPassword}
                            onChange={(e) => updateRegisterData('confirmPassword', e.target.value)}
                            required
                          />
                          <Button
                            type="button"
                            variant="link"
                            className="position-absolute end-0 top-0 h-100 border-0"
                            onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                          >
                            {showConfirmPassword ? <FaEyeSlash /> : <FaEye />}
                          </Button>
                        </div>
                      </Form.Group>

                      <Button
                        type="submit"
                        variant="success"
                        size="lg"
                        className="w-100 mb-3"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                            Creating Account...
                          </>
                        ) : (
                          'Create Account'
                        )}
                      </Button>
                    </Form>
                  </Tab>
                </Tabs>

                <div className="text-center">
                  <small className="text-muted">
                    By signing up, you agree to our Terms of Service and Privacy Policy
                  </small>
                </div>
              </Card.Body>
            </Card>
          </Col>
        </Row>
      </Container>
    </div>
  );
};

export default Login; 