import React, { useState } from 'react';
import { Container, Row, Col, Card, Form, Button, Image } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { postsAPI } from '../services/api';
import { FaUpload, FaTimes, FaSave } from 'react-icons/fa';
import toast from 'react-hot-toast';

const CreatePost: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    contentText: '',
    tags: '',
    image: null as File | null
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif'];
      if (!validTypes.includes(file.type)) {
        toast.error('Please select a valid image file (JPEG, PNG, or GIF)');
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        toast.error('Image size should be less than 5MB');
        return;
      }

      setFormData(prev => ({
        ...prev,
        image: file
      }));

      const reader = new FileReader();
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setFormData(prev => ({
      ...prev,
      image: null
    }));
    setImagePreview(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.contentText.trim()) {
      toast.error('Please enter some content for your post');
      return;
    }

    setLoading(true);

    try {
      const submitData = new FormData();
      submitData.append('contentText', formData.contentText);
      submitData.append('tags', formData.tags);
      
      if (formData.image) {
        submitData.append('image', formData.image);
      }

      await postsAPI.createPost(submitData);
      
      toast.success('Post created successfully!');
      navigate('/');
    } catch (error: any) {
      const message = error.response?.data?.message || 'Failed to create post';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container className="mt-4">
      <Row className="justify-content-center">
        <Col xs={12} md={8} lg={6}>
          <Card className="shadow-sm border-0">
            <Card.Header className="bg-primary text-white">
              <h4 className="mb-0">
                <FaSave className="me-2" />
                Create New Post
              </h4>
            </Card.Header>
            <Card.Body className="p-4">
              <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>Content</strong>
                  </Form.Label>
                  <Form.Control
                    as="textarea"
                    rows={4}
                    name="contentText"
                    value={formData.contentText}
                    onChange={handleInputChange}
                    placeholder="What's on your mind? Share your content here..."
                    required
                  />
                  <Form.Text className="text-muted">
                    {formData.contentText.length}/1000 characters
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                  <Form.Label>
                    <strong>Tags</strong>
                  </Form.Label>
                  <Form.Control
                    type="text"
                    name="tags"
                    value={formData.tags}
                    onChange={handleInputChange}
                    placeholder="Enter tags separated by commas (e.g., tech, programming, tutorial)"
                  />
                  <Form.Text className="text-muted">
                    Tags help categorize your content and improve discoverability
                  </Form.Text>
                </Form.Group>

                <Form.Group className="mb-4">
                  <Form.Label>
                    <strong>Image (Optional)</strong>
                  </Form.Label>
                  
                  {!imagePreview ? (
                    <div className="border-2 border-dashed border-secondary rounded p-4 text-center">
                      <FaUpload className="fa-2x text-muted mb-3" />
                      <p className="text-muted mb-2">
                        Click to upload an image
                      </p>
                      <p className="text-muted small">
                        Supported formats: JPEG, PNG, GIF (Max 10MB)
                      </p>
                      <Form.Control
                        type="file"
                        accept="image/*"
                        onChange={handleImageChange}
                        className="d-none"
                        id="image-upload"
                      />
                      <Button
                        variant="outline-primary"
                        onClick={() => document.getElementById('image-upload')?.click()}
                      >
                        Choose Image
                      </Button>
                    </div>
                  ) : (
                    <div className="position-relative">
                      <Image
                        src={imagePreview}
                        alt="Preview"
                        fluid
                        className="rounded"
                        style={{ maxHeight: '300px', objectFit: 'cover' }}
                      />
                      <Button
                        variant="danger"
                        size="sm"
                        className="position-absolute"
                        style={{
                          top: '8px',
                          right: '8px',
                          zIndex: 10,
                          borderRadius: '50%',
                          width: '32px',
                          height: '32px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                          boxShadow: '0 2px 4px rgba(0,0,0,0.3)'
                        }}
                        onClick={removeImage}
                        title="Remove image"
                      >
                        <FaTimes size={12} />
                      </Button>
                    </div>
                  )}
                </Form.Group>

                <div className="d-grid gap-2">
                  <Button
                    type="submit"
                    variant="primary"
                    size="lg"
                    disabled={loading}
                  >
                    {loading ? (
                      <>
                        <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                        Creating Post...
                      </>
                    ) : (
                      <>
                        <FaSave className="me-2" />
                        Create Post
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

          {/* Tips Card */}
          <Card className="mt-4 border-0 shadow-sm">
            <Card.Body>
              <h6 className="card-title">
                <i className="fas fa-lightbulb text-warning me-2"></i>
                Tips for Better Posts
              </h6>
              <ul className="list-unstyled mb-0">
                <li className="mb-2">
                  <i className="fas fa-check text-success me-2"></i>
                  Write engaging and informative content
                </li>
                <li className="mb-2">
                  <i className="fas fa-check text-success me-2"></i>
                  Use relevant tags to improve discoverability
                </li>
                <li className="mb-2">
                  <i className="fas fa-check text-success me-2"></i>
                  Add high-quality images to make your post stand out
                </li>
                <li className="mb-0">
                  <i className="fas fa-check text-success me-2"></i>
                  Keep your content authentic and valuable to your audience
                </li>
              </ul>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default CreatePost; 