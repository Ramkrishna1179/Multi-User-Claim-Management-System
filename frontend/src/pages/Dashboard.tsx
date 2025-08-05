import React, { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Badge, Button, Modal, Image, Alert, Table, Pagination } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaEye, FaEdit, FaTrash, FaPlus, FaClock, FaCheck, FaTimes, FaThumbsUp, FaEye as FaEyeIcon } from 'react-icons/fa';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { postsAPI, claimsAPI } from '../services/api';
import EditPostModal from '../components/EditPostModal';
import DeductionResponseModal from '../components/DeductionResponseModal';
import toast from 'react-hot-toast';
import { userActionLogger } from '../config/logger';

interface Claim {
  _id: string;
  calculatedEarnings: number;
  status: string;
  createdAt: string;
  deductionAmount: number;
  deductionReason: string;
  postIds: any[];
}

interface Post {
  _id: string;
  contentText: string;
  likeCount: number;
  viewCount: number;
  imageUrl?: string;
  createdAt: string;
}



const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const { onAutoRefresh, offAutoRefresh, socket } = useSocket();
  const navigate = useNavigate();

  const [recentClaims, setRecentClaims] = useState<Claim[]>([]);
  const [recentPosts, setRecentPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [claimsPage, setClaimsPage] = useState(1);
  const [postsPage, setPostsPage] = useState(1);
  const [claimsTotal, setClaimsTotal] = useState(0);
  const [postsTotal, setPostsTotal] = useState(0);
  const [claimsPerPage] = useState(5);
  const [postsPerPage] = useState(5);
  
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showEditPostModal, setShowEditPostModal] = useState(false);
  const [showDeductionModal, setShowDeductionModal] = useState(false);
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [deductionClaim, setDeductionClaim] = useState<Claim | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (user) {
      loadDashboardData();
    }
  }, [user, claimsPage, postsPage]);

  // Register auto-refresh callback
  useEffect(() => {
    const handleAutoRefresh = () => {

      loadDashboardData();
    };

    onAutoRefresh(handleAutoRefresh);

    return () => {
      offAutoRefresh(handleAutoRefresh);
    };
  }, [onAutoRefresh, offAutoRefresh, user]);

  // Separate effect for socket listeners
  useEffect(() => {
    if (!socket || !user) return;
    
    // Listen for deduction notifications
    const handleDeductionApplied = (data: any) => {

      if (data.userId === user.id) {
        // Set the claim data for the modal
        setDeductionClaim(data.claim);
        setShowDeductionModal(true);
        toast.success('A deduction has been applied to your claim. Please review and respond.');
      }
    };
    
    socket.on('deduction_applied', handleDeductionApplied);
    
    return () => {
      socket.off('deduction_applied', handleDeductionApplied);
    };
  }, [socket, user]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      userActionLogger.info('Dashboard data loading started', { userId: user?.id, userRole: user?.role });
      
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 10000)
      );
      
      const apiCalls = [];
      
      if (user?.role === 'user') {
        apiCalls.push(claimsAPI.getUserClaims({ 
          page: claimsPage, 
          limit: claimsPerPage 
        }));
        apiCalls.push(postsAPI.getUserPosts({ 
          page: postsPage, 
          limit: postsPerPage 
        }));
      } else {
        apiCalls.push(claimsAPI.getAllClaims({ 
          page: claimsPage, 
          limit: claimsPerPage 
        }));
      }
      

      
      const results = await Promise.race([
        Promise.all(apiCalls),
        timeoutPromise
      ]) as any[];
      
      const claimsData = results[0].data.claims;
      
      setRecentClaims(claimsData);
      if (results[0].data.pagination) {
        setClaimsTotal(results[0].data.pagination.total * claimsPerPage);
      }
      
      if (user?.role === 'user' && results[1]) {
        setRecentPosts(results[1].data.posts);
        if (results[1].data.pagination) {
          setPostsTotal(results[1].data.pagination.total * postsPerPage);
        }
      }
      
      userActionLogger.info('Dashboard data loaded successfully', { 
        userId: user?.id, 
        userRole: user?.role,
        claimsCount: results[0].data.claims.length,
        postsCount: user?.role === 'user' ? (results[1]?.data.posts.length || 0) : 0
      });
    } catch (error: any) {
      userActionLogger.error('Dashboard data loading failed', { 
        userId: user?.id, 
        userRole: user?.role,
        error: error.message 
      });
      console.error('Dashboard error:', error);
      
      if (error.message === 'Request timeout') {
        toast.error('Dashboard loading timed out. Please refresh the page.');
      } else {
        toast.error('Failed to load dashboard data');
      }
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      pending: { variant: 'warning', text: 'Pending' },
      deducted: { variant: 'danger', text: 'Deducted' },
      user_accepted: { variant: 'info', text: 'Accepted' },
      user_rejected: { variant: 'secondary', text: 'Rejected' },
      account_approved: { variant: 'primary', text: 'Account Approved' },
      admin_approved: { variant: 'success', text: 'Admin Approved' },
      settled: { variant: 'success', text: 'Settled' }
    };

    const config = statusConfig[status as keyof typeof statusConfig] || { variant: 'secondary', text: status };
    return <Badge bg={config.variant}>{config.text}</Badge>;
  };

  const getStatusColor = (status: string) => {
    const statusConfig = {
      pending: 'warning',
      deducted: 'danger',
      user_accepted: 'info',
      user_rejected: 'secondary',
      account_approved: 'primary',
      admin_approved: 'success',
      settled: 'success'
    };
    return statusConfig[status as keyof typeof statusConfig] || 'secondary';
  };

  const getStatusText = (status: string) => {
    const statusConfig = {
      pending: 'Pending',
      deducted: 'Deducted',
      user_accepted: 'Accepted',
      user_rejected: 'Rejected',
      account_approved: 'Account Approved',
      admin_approved: 'Admin Approved',
      settled: 'Settled'
    };
    return statusConfig[status as keyof typeof statusConfig] || status;
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

  const handleViewClaim = (claim: Claim) => {
    setSelectedClaim(claim);
    setShowClaimModal(true);
  };

  const handleClaimAction = async (action: 'accept' | 'reject' | 'final-approve') => {
    if (!selectedClaim) return;

    try {
      setProcessing(true);
      
      if (action === 'accept' || action === 'reject') {
        await claimsAPI.respondToDeduction(selectedClaim._id, action === 'accept');
        toast.success(action === 'accept' 
          ? 'Deduction accepted! Claim moved to Admin for final approval.'
          : 'Deduction rejected! Claim returned to Account for re-review.'
        );
      } else if (action === 'final-approve') {
        await claimsAPI.adminApprove(selectedClaim._id);
        toast.success('Claim approved! Final settlement completed.');
      }
      
      setShowClaimModal(false);
      setSelectedClaim(null);
      loadDashboardData();
    } catch (error: any) {
      console.error('Claim action error:', error);
      toast.error('Action failed: ' + (error.response?.data?.message || error.message));
    } finally {
      setProcessing(false);
    }
  };

  const handleViewPost = (post: Post) => {
    setSelectedPost(post);
    setShowPostModal(true);
  };

  const handleEditPost = (post: Post) => {
    setSelectedPost(post);
    setShowEditPostModal(true);
  };

  const handleDeletePost = async (postId: string) => {
    if (window.confirm('Are you sure you want to delete this post?')) {
      try {
        await postsAPI.deletePost(postId);
        toast.success('Post deleted successfully');
        loadDashboardData();
      } catch (error: any) {
        toast.error('Failed to delete post');
      }
    }
  };

  const handlePostUpdated = () => {
    loadDashboardData();
  };

  const handleIncreaseLikes = async (postId: string) => {
    try {
      await postsAPI.incrementLikes(postId);
      toast.success('Likes increased for testing!');
      loadDashboardData(); // Refresh to show updated counts
    } catch (error: any) {
      toast.error('Failed to increase likes');
    }
  };

  const handleIncreaseViews = async (postId: string) => {
    try {
      await postsAPI.incrementViews(postId);
      toast.success('Views increased for testing!');
      loadDashboardData(); // Refresh to show updated counts
    } catch (error: any) {
      toast.error('Failed to increase views');
    }
  };

  // Pagination handlers
  const handleClaimsPageChange = (page: number) => {
    setClaimsPage(page);
  };

  const handlePostsPageChange = (page: number) => {
    setPostsPage(page);
  };

  if (loading) {
    return (
      <Container className="mt-4">
        <div className="text-center">
          <div className="spinner-border text-primary" role="status">
            <span className="visually-hidden">Loading...</span>
          </div>
          <p className="mt-3">Loading dashboard...</p>
        </div>
      </Container>
    );
  }

  return (
    <Container className="mt-4">
      <Row>
        <Col xs={12}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-primary text-white">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="mb-0">
                    Dashboard
                  </h4>
                  <small>Welcome back, {user?.name}! Here's what's happening with your {user?.role === 'user' ? 'content and claims' : 'claims review'}.</small>
                </div>
                <div className="d-flex align-items-center gap-3">
                  <div className="text-light small">
                    <i className="fas fa-sync-alt me-1"></i>
                    Auto-refresh enabled
                  </div>
                </div>
              </div>
            </Card.Header>
            <Card.Body className="p-4">

          {/* Quick Actions */}
          <Row className="mb-4">
            <Col>
              <Card className="border-0 shadow-sm">
                <Card.Body>
                  <h5 className="card-title mb-3">Quick Actions</h5>
                  <div className="d-flex flex-wrap gap-2">
                    {user?.role === 'user' && (
                      <>
                        <Button variant="primary" size="sm" onClick={() => navigate('/create-post')}>
                          <FaPlus className="me-2" />
                          Create Post
                        </Button>
                        <Button variant="success" size="sm" onClick={() => navigate('/submit-claim')}>
                          <FaClock className="me-2" />
                          Submit Claim
                        </Button>
                      </>
                    )}
                    {user?.role === 'account' && (
                      <Button variant="warning" size="sm" onClick={() => navigate('/review-claims')}>
                        <FaEye className="me-2" />
                        Review Claims
                      </Button>
                    )}
                    {user?.role === 'admin' && (
                      <>
                        <Button variant="danger" size="sm" onClick={() => navigate('/final-approval')}>
                          <FaEye className="me-2" />
                          Final Approval
                        </Button>
                        <Button variant="info" size="sm" onClick={() => navigate('/reports')}>
                          <FaEye className="me-2" />
                          View Reports
                        </Button>
                      </>
                    )}
                  </div>
                </Card.Body>
              </Card>
            </Col>
          </Row>



          {/* Recent Claims */}
          <Row className="mb-4">
            <Col>
              <Card className="border-0 shadow-sm">
                <Card.Header className="bg-primary text-white">
                  <div className="d-flex justify-content-between align-items-center">
                    <h5 className="mb-0">Recent Claims</h5>
                    <Button variant="link" className="text-white text-decoration-none" onClick={() => navigate('/claims')}>
                      View All
                    </Button>
                  </div>
                </Card.Header>
                <Card.Body>
                  {recentClaims.length > 0 ? (
                    <Table responsive hover>
                      <thead>
                        <tr>
                          <th>Earnings</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {recentClaims.map((claim) => (
                          <tr key={claim._id}>
                            <td>{formatCurrency(claim.calculatedEarnings)}</td>
                            <td>{getStatusBadge(claim.status)}</td>
                            <td>{formatDate(claim.createdAt)}</td>
                            <td>
                              <Button
                                variant="outline-primary"
                                size="sm"
                                onClick={() => handleViewClaim(claim)}
                                title="View Claim Details"
                              >
                                <FaEye />
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </Table>
                  ) : (
                    <Alert variant="info">No claims found.</Alert>
                  )}
                  
                  {/* Claims Pagination */}
                  {claimsTotal > claimsPerPage && (
                    <div className="d-flex justify-content-center mt-3">
                      <Pagination>
                        <Pagination.First 
                          onClick={() => handleClaimsPageChange(1)}
                          disabled={claimsPage === 1}
                        />
                        <Pagination.Prev 
                          onClick={() => handleClaimsPageChange(claimsPage - 1)}
                          disabled={claimsPage === 1}
                        />
                        
                        {Array.from({ length: Math.min(5, Math.ceil(claimsTotal / claimsPerPage)) }, (_, i) => {
                          const pageNum = Math.max(1, claimsPage - 2) + i;
                          if (pageNum > Math.ceil(claimsTotal / claimsPerPage)) return null;
                          return (
                            <Pagination.Item
                              key={pageNum}
                              active={pageNum === claimsPage}
                              onClick={() => handleClaimsPageChange(pageNum)}
                            >
                              {pageNum}
                            </Pagination.Item>
                          );
                        })}
                        
                        <Pagination.Next 
                          onClick={() => handleClaimsPageChange(claimsPage + 1)}
                          disabled={claimsPage >= Math.ceil(claimsTotal / claimsPerPage)}
                        />
                        <Pagination.Last 
                          onClick={() => handleClaimsPageChange(Math.ceil(claimsTotal / claimsPerPage))}
                          disabled={claimsPage >= Math.ceil(claimsTotal / claimsPerPage)}
                        />
                      </Pagination>
                    </div>
                  )}
                </Card.Body>
              </Card>
            </Col>
          </Row>

          {/* Recent Posts (Only for users) */}
          {user?.role === 'user' && (
            <Row className="mb-4">
              <Col>
                <Card className="border-0 shadow-sm">
                  <Card.Header className="bg-success text-white">
                    <div className="d-flex justify-content-between align-items-center">
                      <h5 className="mb-0">Recent Posts</h5>
                      <Button variant="link" className="text-white text-decoration-none" onClick={() => navigate('/posts')}>
                        View All
                      </Button>
                    </div>
                  </Card.Header>
                  <Card.Body>
                    {/* Testing Warning Note */}
                    <Alert variant="warning" className="mb-3">
                      <strong>🧪 Testing Mode:</strong> The buttons below are for testing purposes only. 
                      They allow you to increase likes and views to test the complete earnings calculation flow. 
                      <strong> Do not use in production!</strong>
                    </Alert>
                    
                    {recentPosts.length > 0 ? (
                      <Table responsive hover>
                        <thead>
                          <tr>
                            <th>Content</th>
                            <th>Likes</th>
                            <th>Views</th>
                            <th>Date</th>
                            <th>Actions</th>
                            <th>🧪 Testing</th>
                          </tr>
                        </thead>
                        <tbody>
                          {recentPosts.map((post) => (
                            <tr key={post._id}>
                              <td>
                                <div className="text-truncate" style={{ maxWidth: '200px' }}>
                                  {post.contentText}
                                </div>
                              </td>
                              <td>
                                <Badge bg="danger">{post.likeCount}</Badge>
                              </td>
                              <td>
                                <Badge bg="info">{post.viewCount}</Badge>
                              </td>
                              <td>{formatDate(post.createdAt)}</td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <Button
                                    variant="outline-primary"
                                    size="sm"
                                    onClick={() => handleViewPost(post)}
                                    title="View Post Details"
                                  >
                                    <FaEye />
                                  </Button>
                                  <Button
                                    variant="outline-secondary"
                                    size="sm"
                                    onClick={() => handleEditPost(post)}
                                    title="Edit Post"
                                  >
                                    <FaEdit />
                                  </Button>
                                  <Button
                                    variant="outline-danger"
                                    size="sm"
                                    onClick={() => handleDeletePost(post._id)}
                                    title="Delete Post"
                                  >
                                    <FaTrash />
                                  </Button>
                                </div>
                              </td>
                              <td>
                                <div className="btn-group btn-group-sm">
                                  <Button
                                    variant="outline-success"
                                    size="sm"
                                    onClick={() => handleIncreaseLikes(post._id)}
                                    title="🧪 Increase Likes (Testing)"
                                  >
                                    <FaThumbsUp />
                                  </Button>
                                  <Button
                                    variant="outline-info"
                                    size="sm"
                                    onClick={() => handleIncreaseViews(post._id)}
                                    title="🧪 Increase Views (Testing)"
                                  >
                                    <FaEyeIcon />
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </Table>
                    ) : (
                      <Alert variant="info">No posts found.</Alert>
                    )}
                    
                    {/* Posts Pagination */}
                    {postsTotal > postsPerPage && (
                      <div className="d-flex justify-content-center mt-3">
                        <Pagination>
                          <Pagination.First 
                            onClick={() => handlePostsPageChange(1)}
                            disabled={postsPage === 1}
                          />
                          <Pagination.Prev 
                            onClick={() => handlePostsPageChange(postsPage - 1)}
                            disabled={postsPage === 1}
                          />
                          
                          {Array.from({ length: Math.min(5, Math.ceil(postsTotal / postsPerPage)) }, (_, i) => {
                            const pageNum = Math.max(1, postsPage - 2) + i;
                            if (pageNum > Math.ceil(postsTotal / postsPerPage)) return null;
                            return (
                              <Pagination.Item
                                key={pageNum}
                                active={pageNum === postsPage}
                                onClick={() => handlePostsPageChange(pageNum)}
                              >
                                {pageNum}
                              </Pagination.Item>
                            );
                          })}
                          
                          <Pagination.Next 
                            onClick={() => handlePostsPageChange(postsPage + 1)}
                            disabled={postsPage >= Math.ceil(postsTotal / postsPerPage)}
                          />
                          <Pagination.Last 
                            onClick={() => handlePostsPageChange(Math.ceil(postsTotal / postsPerPage))}
                            disabled={postsPage >= Math.ceil(postsTotal / postsPerPage)}
                          />
                        </Pagination>
                      </div>
                    )}
                  </Card.Body>
                </Card>
              </Col>
            </Row>
          )}

          {/* Claim Details Modal */}
          <Modal show={showClaimModal} onHide={() => setShowClaimModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>Claim Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedClaim && (
                <div>
                  <Row className="mb-3">
                    <Col md={6}>
                      <h6>Original Earnings</h6>
                      <Badge bg="success" className="fs-6">
                        {formatCurrency(selectedClaim.calculatedEarnings)}
                      </Badge>
                    </Col>
                    <Col md={6}>
                      <h6>Status</h6>
                      <Badge bg={getStatusColor(selectedClaim.status)} className="fs-6">
                        {getStatusText(selectedClaim.status)}
                      </Badge>
                    </Col>
                  </Row>

                  {selectedClaim.deductionAmount > 0 && (
                    <>
                      <Row className="mb-3">
                        <Col md={6}>
                          <h6>Deduction Amount</h6>
                          <Badge bg="danger" className="fs-6">
                            -{formatCurrency(selectedClaim.deductionAmount)}
                          </Badge>
                        </Col>
                        <Col md={6}>
                          <h6>Final Amount After Deduction</h6>
                          <Badge bg="primary" className="fs-6">
                            {formatCurrency(selectedClaim.calculatedEarnings - selectedClaim.deductionAmount)}
                          </Badge>
                        </Col>
                      </Row>

                      <div className="mb-3">
                        <h6>Deduction Reason</h6>
                        <div className="border rounded p-3 bg-light">
                          {selectedClaim.deductionReason}
                        </div>
                      </div>
                    </>
                  )}

                  <div className="mb-3">
                    <h6>Created</h6>
                    <p>{formatDate(selectedClaim.createdAt)}</p>
                  </div>

                  {/* Role-specific action buttons */}
                  {user?.role === 'user' && selectedClaim.status === 'deducted' && (
                    <Alert variant="warning" className="mt-3">
                      <strong>Action Required:</strong> Please respond to the deduction applied to your claim.
                      <div className="d-flex gap-2 mt-3">
                        <Button
                          variant="success"
                          onClick={() => handleClaimAction('accept')}
                          disabled={processing}
                        >
                          <FaCheck className="me-2" />
                          Accept Deduction
                        </Button>
                        <Button
                          variant="danger"
                          onClick={() => handleClaimAction('reject')}
                          disabled={processing}
                        >
                          <FaTimes className="me-2" />
                          Reject Deduction
                        </Button>
                      </div>
                    </Alert>
                  )}

                  {user?.role === 'admin' && selectedClaim.status === 'user_accepted' && (
                    <Alert variant="info" className="mt-3">
                      <strong>Final Approval Required:</strong> User has accepted the deduction. Please give final approval.
                      <div className="d-flex gap-2 mt-3">
                        <Button
                          variant="success"
                          onClick={() => handleClaimAction('final-approve')}
                          disabled={processing}
                        >
                          <FaCheck className="me-2" />
                          Final Approve
                        </Button>
                      </div>
                    </Alert>
                  )}

                  {processing && (
                    <div className="text-center mt-3">
                      <div className="spinner-border text-primary" role="status">
                        <span className="visually-hidden">Loading...</span>
                      </div>
                      <p className="mt-2">Processing...</p>
                    </div>
                  )}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowClaimModal(false)}>
                Close
              </Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  setShowClaimModal(false);
                  navigate('/claims');
                }}
              >
                View All Claims
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Post Details Modal */}
          <Modal show={showPostModal} onHide={() => setShowPostModal(false)} size="lg">
            <Modal.Header closeButton>
              <Modal.Title>Post Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
              {selectedPost && (
                <div>
                  <Row>
                    <Col md={8}>
                      <h6>Content</h6>
                      <p className="border rounded p-3 bg-light">{selectedPost.contentText}</p>
                    </Col>
                    <Col md={4}>
                      <h6>Engagement</h6>
                      <p><strong>Likes:</strong> <Badge bg="danger">{selectedPost.likeCount}</Badge></p>
                      <p><strong>Views:</strong> <Badge bg="info">{selectedPost.viewCount}</Badge></p>
                      <p><strong>Created:</strong> {formatDate(selectedPost.createdAt)}</p>
                    </Col>
                  </Row>
                  {selectedPost.imageUrl && (
                    <Row className="mt-3">
                      <Col>
                        <h6>Image</h6>
                        <Image 
                          src={`http://localhost:5000${selectedPost.imageUrl}`} 
                          alt="Post" 
                          className="img-fluid rounded"
                          style={{ maxHeight: '300px' }}
                          onError={(e) => {
                            console.error('Image failed to load:', selectedPost.imageUrl);
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      </Col>
                    </Row>
                  )}
                </div>
              )}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="secondary" onClick={() => setShowPostModal(false)}>
                Close
              </Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  setShowPostModal(false);
                  navigate('/posts');
                }}
              >
                View All Posts
              </Button>
            </Modal.Footer>
          </Modal>

          {/* Edit Post Modal */}
          <EditPostModal
            show={showEditPostModal}
            onHide={() => setShowEditPostModal(false)}
            post={selectedPost}
            onPostUpdated={handlePostUpdated}
          />

          {/* Deduction Response Modal */}
          <DeductionResponseModal
            show={showDeductionModal}
            onHide={() => setShowDeductionModal(false)}
            claim={deductionClaim}
            onResponseSubmitted={handlePostUpdated}
          />
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default Dashboard; 