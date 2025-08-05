import React, { useState, useEffect } from 'react';
import { Modal, Form, Button, Alert, Image } from 'react-bootstrap';
import { postsAPI } from '../services/api';
import { FaTimes } from 'react-icons/fa';
import toast from 'react-hot-toast';

interface Post {
  _id: string;
  contentText: string;
  imageUrl?: string;
  likeCount: number;
  viewCount: number;
  createdAt: string;
}

interface EditPostModalProps {
  show: boolean;
  onHide: () => void;
  post: Post | null;
  onPostUpdated: () => void;
}

const EditPostModal: React.FC<EditPostModalProps> = ({ show, onHide, post, onPostUpdated }) => {
  const [contentText, setContentText] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string>('');

  useEffect(() => {
    if (post) {
      setContentText(post.contentText);
      setCurrentImageUrl(post.imageUrl || '');
      setImageFile(null);
      setPreviewUrl('');
    }
  }, [post]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        setPreviewUrl(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
    setPreviewUrl('');
    setCurrentImageUrl('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!post) return;

    if (!contentText.trim()) {
      toast.error('Please enter post content');
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append('contentText', contentText);
      
      if (imageFile) {
        formData.append('image', imageFile);
      }

      await postsAPI.updatePost(post._id, formData);
      
      toast.success('Post updated successfully!');
      onPostUpdated();
      onHide();
    } catch (error: any) {
      console.error('Error updating post:', error);
      toast.error('Failed to update post: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal show={show} onHide={onHide} size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Edit Post</Modal.Title>
      </Modal.Header>
      <Form onSubmit={handleSubmit}>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label>Post Content</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={contentText}
              onChange={(e) => setContentText(e.target.value)}
              placeholder="What's on your mind?"
              required
            />
          </Form.Group>

          <Form.Group className="mb-3">
            <Form.Label>Image (Optional)</Form.Label>
            <div className="d-flex align-items-center gap-2 mb-2">
              <Form.Control
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="flex-grow-1"
              />
              {(imageFile || currentImageUrl) && (
                <Button 
                  variant="outline-danger" 
                  size="sm"
                  onClick={removeImage}
                  type="button"
                >
                  <FaTimes />
                </Button>
              )}
            </div>

            {/* Show current image or preview */}
            {(currentImageUrl || previewUrl) && (
              <div className="mt-2">
                <Image
                  src={previewUrl || `http://localhost:5000${currentImageUrl}`}
                  alt="Post preview"
                  className="img-fluid rounded"
                  style={{ maxHeight: '200px' }}
                />
              </div>
            )}
          </Form.Group>

          {/* Post stats (read-only) */}
          {post && (
            <Alert variant="info">
              <strong>Post Statistics:</strong>
              <div className="mt-2">
                <span className="badge bg-danger me-2">Likes: {post.likeCount}</span>
                <span className="badge bg-info me-2">Views: {post.viewCount}</span>
                <span className="badge bg-secondary">Created: {new Date(post.createdAt).toLocaleDateString()}</span>
              </div>
            </Alert>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={onHide} disabled={loading}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" disabled={loading}>
            {loading ? 'Updating...' : 'Update Post'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
};

export default EditPostModal; 