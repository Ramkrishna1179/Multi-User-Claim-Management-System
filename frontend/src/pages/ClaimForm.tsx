import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Form, Button, Alert, Table, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { claimsAPI, postsAPI, settingsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FaTimes, FaFileAlt, FaCheck } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface Post {
  _id: string;
  contentText: string;
  likeCount: number;
  viewCount: number;
  imageUrl?: string;
  createdAt: string;
}

interface AdminSettings {
  ratePerLike: number;
  ratePer100Views: number;
}

const ClaimForm: React.FC = () => {
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  const [loading, setLoading] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [posts, setPosts] = useState<Post[]>([]);
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [proofFiles, setProofFiles] = useState<File[]>([]);
  const [calculatedEarnings, setCalculatedEarnings] = useState(0);
  const [adminSettings, setAdminSettings] = useState<AdminSettings>({
    ratePerLike: 0.01,
    ratePer100Views: 0.50
  });
  const [existingClaims, setExistingClaims] = useState<any[]>([]);

  useEffect(() => {
    if (isAuthenticated && user) {
      loadUserPosts();
      loadAdminSettings();
      loadExistingClaims();
    } else {
      navigate('/login');
    }
  }, [isAuthenticated, user, navigate]);

  useEffect(() => {
    if (selectedPosts.length > 0) {
      const selectedPostsData = posts.filter(post => selectedPosts.includes(post._id));
      const totalEarnings = selectedPostsData.reduce((sum, post) => {
        const likeEarnings = post.likeCount * adminSettings.ratePerLike;
        const viewEarnings = (post.viewCount / 100) * adminSettings.ratePer100Views;
        return sum + likeEarnings + viewEarnings;
      }, 0);
      
      setCalculatedEarnings(Math.round(totalEarnings * 100) / 100);
    }
  }, [adminSettings, selectedPosts, posts]);

  const loadUserPosts = async () => {
    try {
      const response = await postsAPI.getUserPosts({ limit: 50 });
      setPosts(response.data.posts);
    } catch (error: any) {
      toast.error('Failed to load posts: ' + (error.response?.data?.message || error.message));
    }
  };

  const loadAdminSettings = async () => {
    try {
      setSettingsLoading(true);
      const response = await settingsAPI.getCurrentSettings();
      setAdminSettings(response.data.settings);
    } catch (error) {
    } finally {
      setSettingsLoading(false);
    }
  };

  const loadExistingClaims = async () => {
    try {
      const response = await claimsAPI.getUserClaims({ limit: 100 });
      setExistingClaims(response.data.claims);
    } catch (error) {
    }
  };

  const handlePostSelection = (postId: string) => {
    // Prevent selection of already claimed posts
    if (isPostAlreadyClaimed(postId)) {
      toast.error('This post is already included in an active claim');
      return;
    }

    setSelectedPosts(prev => {
      const newSelection = prev.includes(postId)
        ? prev.filter(id => id !== postId)
        : [...prev, postId];
      
      // Calculate earnings based on selected posts using admin settings
      const selectedPostsData = posts.filter(post => newSelection.includes(post._id));
      const totalEarnings = selectedPostsData.reduce((sum, post) => {
        const likeEarnings = post.likeCount * adminSettings.ratePerLike;
        const viewEarnings = (post.viewCount / 100) * adminSettings.ratePer100Views;
        return sum + likeEarnings + viewEarnings;
      }, 0);
      
      setCalculatedEarnings(Math.round(totalEarnings * 100) / 100);
      return newSelection;
    });
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    
    // Validate file types
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'application/pdf'];
    const invalidFiles = files.filter(file => !validTypes.includes(file.type));
    
    if (invalidFiles.length > 0) {
      toast.error('Please select valid files (JPEG, PNG, GIF, or PDF)');
      return;
    }

    // Validate file sizes (10MB each)
    const oversizedFiles = files.filter(file => file.size > 10 * 1024 * 1024);
    if (oversizedFiles.length > 0) {
      toast.error('Files must be smaller than 10MB each');
      return;
    }

    setProofFiles(prev => [...prev, ...files]);
  };

  const removeFile = (index: number) => {
    setProofFiles(prev => prev.filter((_, i) => i !== index));
  };

  const isPostAlreadyClaimed = (postId: string) => {
    // Simple check: if any existing claim contains this postId, it's already claimed
    return existingClaims.some(claim => 
      claim.postIds.some((id: string) => id === postId) && 
      claim.isActive
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedPosts.length === 0) {
      toast.error('Please select at least one post');
      return;
    }

    if (proofFiles.length === 0) {
      toast.error('Please upload at least one proof file');
      return;
    }

    setLoading(true);

    try {
      // Pre-validate with backend to check for duplicate claims
      const validationResponse = await claimsAPI.checkPostsAlreadyClaimed(selectedPosts);
      
      if (validationResponse.data.alreadyClaimed) {
        const conflictingPosts = validationResponse.data.conflictingPosts.join(', ');
        const errorMessage = `❌ Duplicate Claim Detected: The following posts are already claimed: ${conflictingPosts}. Each post can only be claimed once.`;
        
        toast.error(errorMessage);
        setLoading(false);
        return;
      }

      const formData = new FormData();
      formData.append('postIds', JSON.stringify(selectedPosts));
      
      proofFiles.forEach(file => {
        formData.append('proofFiles', file);
      });

      await claimsAPI.submitClaim(formData);
      
      toast.success('Claim submitted successfully!');
      navigate('/');
    } catch (error: any) {
      console.log('Claim submission error:', error);
      console.log('Error response:', error.response?.data);
      
      let message = 'Failed to submit claim';
      
      // Try to extract the specific error message
      if (error.response?.data?.message) {
        message = error.response.data.message;
      } else if (error.message) {
        message = error.message;
      }
      
      // Show the error message directly since backend now returns proper messages
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-center">
        <Col xs={12} lg={10}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-success text-white">
              <h4 className="mb-0">
                <FaFileAlt className="me-2" />
                Submit Earnings Claim
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleSubmit}>
                {/* Post Selection */}
                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>Select Posts for Claim</strong>
                  </Form.Label>
                  <Alert variant="info">
                    <strong>Earnings Calculation:</strong> 
                    {settingsLoading ? (
                      <span className="text-muted">Loading rates...</span>
                    ) : (
                      <span>
                        ₹{adminSettings.ratePerLike.toFixed(2)} per like + ₹{adminSettings.ratePer100Views.toFixed(2)} per 100 views
                      </span>
                    )}
                  </Alert>
                  <Alert variant="warning">
                    <strong>Important:</strong> Each post can only be claimed ONCE. Once a post is claimed and settled, it cannot be claimed again. This prevents duplicate earnings claims.
                  </Alert>
                  
                  {posts.length > 0 ? (
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>Select</th>
                          <th>Content</th>
                          <th>Likes</th>
                          <th>Views</th>
                          <th>Date</th>
                          <th>Earnings</th>
                        </tr>
                      </thead>
                      <tbody>
                        {posts.map((post) => {
                          const postEarnings = (post.likeCount * adminSettings.ratePerLike) + ((post.viewCount / 100) * adminSettings.ratePer100Views);
                          const isAlreadyClaimed = isPostAlreadyClaimed(post._id);
                          return (
                            <tr key={post._id} className={isAlreadyClaimed ? 'table-secondary' : ''}>
                              <td>
                                <Form.Check
                                  type="checkbox"
                                  checked={selectedPosts.includes(post._id)}
                                  onChange={() => handlePostSelection(post._id)}
                                  disabled={isAlreadyClaimed}
                                />
                              </td>
                              <td>
                                <div className="text-truncate" style={{ maxWidth: '200px' }}>
                                  {post.contentText}
                                  {isAlreadyClaimed && (
                                    <Badge bg="warning" className="ms-2">
                                      Already Claimed
                                    </Badge>
                                  )}
                                </div>
                              </td>
                              <td>
                                <Badge bg="danger">{post.likeCount}</Badge>
                              </td>
                              <td>
                                <Badge bg="info">{post.viewCount}</Badge>
                              </td>
                              <td>{formatDate(post.createdAt)}</td>
                              <td className="fw-bold text-success">
                                {formatCurrency(postEarnings)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="warning">
                      No posts found. Please create some posts first.
                    </Alert>
                  )}
                </Form.Group>

                {/* Proof Files */}
                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>Upload Proof Files</strong>
                  </Form.Label>
                  <Alert variant="info">
                    Upload screenshots or documents as proof of your earnings. 
                    Supported formats: JPEG, PNG, GIF, PDF (Max 10MB each)
                  </Alert>
                  
                  <div className="mb-3">
                    <Form.Control
                      type="file"
                      multiple
                      accept="image/*,.pdf"
                      onChange={handleFileUpload}
                      className="mb-2"
                    />
                  </div>

                  {proofFiles.length > 0 && (
                    <div>
                      <h6>Selected Files:</h6>
                      <div className="d-flex flex-wrap gap-2">
                        {proofFiles.map((file, index) => (
                          <div key={index} className="d-flex align-items-center bg-light p-2 rounded">
                            <FaFileAlt className="me-2 text-primary" />
                            <span className="me-2">{file.name}</span>
                            <Button
                              variant="outline-danger"
                              size="sm"
                              onClick={() => removeFile(index)}
                            >
                              <FaTimes />
                            </Button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </Form.Group>

                {/* Summary */}
                {selectedPosts.length > 0 && (
                  <Card className="mb-4 bg-light">
                    <Card.Body>
                      <h6 className="card-title">Claim Summary</h6>
                      <Row>
                        <Col md={6}>
                          <p><strong>Selected Posts:</strong> {selectedPosts.length}</p>
                          <p><strong>Proof Files:</strong> {proofFiles.length}</p>
                        </Col>
                        <Col md={6}>
                          <p><strong>Total Earnings:</strong></p>
                          <h4 className={`mb-0 ${calculatedEarnings <= 0 ? 'text-danger' : 'text-success'}`}>
                            {formatCurrency(calculatedEarnings)}
                          </h4>
                          {calculatedEarnings <= 0 && (
                            <small className="text-danger">
                              ⚠️ You cannot submit a claim with ₹0 or negative earnings
                            </small>
                          )}
                        </Col>
                      </Row>
                    </Card.Body>
                  </Card>
                )}

                {/* Warning for zero earnings */}
                {selectedPosts.length > 0 && calculatedEarnings <= 0 && (
                  <Alert variant="danger" className="mb-4">
                    <strong>Cannot Submit Claim</strong>
                    <br />
                    Your selected posts have a total earning of {formatCurrency(calculatedEarnings)}. 
                    You cannot submit a claim with ₹0 or negative earnings. 
                    Please select posts with positive earnings to proceed.
                  </Alert>
                )}

                {/* Submit Button */}
                <div className="d-grid gap-2">
                  <Button
                    type="submit"
                    variant="success"
                    size="lg"
                    disabled={loading || selectedPosts.length === 0 || proofFiles.length === 0 || calculatedEarnings <= 0}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Submitting Claim...
                      </>
                    ) : calculatedEarnings <= 0 ? (
                      <>
                        <FaTimes className="me-2" />
                        Cannot Submit (₹0 Earnings)
                      </>
                    ) : (
                      <>
                        <FaCheck className="me-2" />
                        Submit Claim
                      </>
                    )}
                  </Button>
                  
                  <Button
                    type="button"
                    variant="outline-secondary"
                    onClick={() => navigate('/')}
                  >
                    Cancel
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default ClaimForm; 