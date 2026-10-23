import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { donationsService } from '../../services/donationsService.js';
import { Button, Input, Select, Textarea, FormField, Checkbox } from '../../components/ui/FormElements.jsx';
import { Alert } from '../../components/ui/Alert.jsx';
import { SuccessState } from '../../components/ui/States.jsx';
import { DONATION_CATEGORIES, STORAGE_REQUIREMENTS } from '@aidflow/shared';
import { Package, ArrowLeft, CheckCircle2, MapPin } from 'lucide-react';

export function DonorCreateDonationPage() {
  const { user, forceMock } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const [form, setForm] = useState({
    title: '',
    category: 'PRODUCE',
    quantity: 25,
    unit: 'kg',
    storageRequirement: 'ROOM_TEMPERATURE',
    expirationDate: new Date(Date.now() + 86400000 * 2).toISOString().slice(0, 16),
    address: '580 Market St, San Francisco, CA',
    contactName: user?.name || 'Store Manager',
    contactPhone: '+1 (415) 555-0199',
    description: '',
    allergens: []
  });

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (error) setError(null);
  };

  const handleAllergenToggle = (allergen) => {
    setForm((prev) => {
      const exists = prev.allergens.includes(allergen);
      return {
        ...prev,
        allergens: exists
          ? prev.allergens.filter((a) => a !== allergen)
          : [...prev.allergens, allergen]
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const payload = {
        donorId: user?.id || 'usr_donor_01',
        title: form.title,
        aidType: form.category,
        category: form.category,
        quantity: Number(form.quantity),
        unit: form.unit,
        handlingRequirements: form.storageRequirement,
        storageRequirement: form.storageRequirement,
        safeUseDeadline: new Date(form.expirationDate).toISOString(),
        expirationDate: new Date(form.expirationDate).toISOString(),
        description: form.description,
        allergens: form.allergens,
        pickupLocation: {
          address: form.address,
          latitude: 37.789,
          longitude: -122.405,
          contactName: form.contactName,
          contactPhone: form.contactPhone
        }
      };

      const res = await donationsService.createDonation(payload, { forceMock });
      if (res.success) {
        setSuccess(true);
      } else {
        let msg = res.error || 'Failed to register donation.';
        if (res.details && Array.isArray(res.details)) {
          const detailMsgs = res.details.map((d) => `${d.path?.join('.') || 'Field'}: ${d.message}`).join(' | ');
          msg = `${msg}: ${detailMsgs}`;
        }
        setError(msg);
      }
    } catch (err) {
      setError(err.message || 'Submission error');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="max-w-xl mx-auto py-12">
        <SuccessState
          title="Surplus Aid Registered Successfully!"
          description="Your donation has been added to the AidFlow dispatch pipeline. Nearby shelters will be matched and a volunteer courier notified for pickup."
          actionLabel="View in My Listings"
          onAction={() => navigate('/donor')}
        />
      </div>
    );
  }

  const commonAllergens = ['Gluten / Wheat', 'Dairy / Lactose', 'Nuts', 'Soy', 'Eggs', 'Shellfish'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-800">
        <button
          onClick={() => navigate('/donor')}
          className="p-1.5 rounded-lg border border-slate-800 bg-slate-900 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Post Surplus Aid or Food
          </h2>
          <p className="text-xs text-slate-400">
            Provide details on perishable inventory, quantity, and pickup location for dispatch.
          </p>
        </div>
      </div>

      {error && <Alert variant="error" onClose={() => setError(null)}>{error}</Alert>}

      <form onSubmit={handleSubmit} className="glass-card rounded-2xl border border-slate-800 p-6 sm:p-8 space-y-6">
        {/* Section 1: Aid Details */}
        <div className="space-y-4">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
            1. Aid Information & Packaging
          </h4>

          <FormField label="Donation Title" required hint="e.g. Fresh Bagels & Danishes">
            <Input
              value={form.title}
              onChange={(e) => handleChange('title', e.target.value)}
              placeholder="Descriptive title of surplus aid goods"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <FormField label="Category" required>
              <Select
                value={form.category}
                onChange={(e) => handleChange('category', e.target.value)}
              >
                {DONATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Quantity" required>
              <Input
                type="number"
                min="1"
                value={form.quantity}
                onChange={(e) => handleChange('quantity', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Unit of Measure" required>
              <Input
                value={form.unit}
                onChange={(e) => handleChange('unit', e.target.value)}
                placeholder="kg, loaves, servings, boxes"
                required
              />
            </FormField>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Storage Requirement" required>
              <Select
                value={form.storageRequirement}
                onChange={(e) => handleChange('storageRequirement', e.target.value)}
              >
                {STORAGE_REQUIREMENTS.map((req) => (
                  <option key={req} value={req}>
                    {req.replace(/_/g, ' ')}
                  </option>
                ))}
              </Select>
            </FormField>

            <FormField label="Expiration Date & Time" required>
              <Input
                type="datetime-local"
                value={form.expirationDate}
                onChange={(e) => handleChange('expirationDate', e.target.value)}
                required
              />
            </FormField>
          </div>

          <FormField label="Item Description & Notes" hint="Optional">
            <Textarea
              value={form.description}
              onChange={(e) => handleChange('description', e.target.value)}
              placeholder="e.g. Prepared hot breakfast trays packed in sealed aluminum containers."
              rows={2}
            />
          </FormField>

          <div className="space-y-2 pt-1">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-300">
              Allergen Notice
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {commonAllergens.map((alg) => (
                <Checkbox
                  key={alg}
                  id={`alg-${alg}`}
                  label={alg}
                  checked={form.allergens.includes(alg)}
                  onChange={() => handleAllergenToggle(alg)}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Section 2: Pickup Location */}
        <div className="space-y-4 pt-4 border-t border-slate-800">
          <h4 className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5" />
            2. Courier Pickup Logistics
          </h4>

          <FormField label="Pickup Physical Address" required>
            <Input
              value={form.address}
              onChange={(e) => handleChange('address', e.target.value)}
              placeholder="Full street address and suite/loading dock number"
              required
            />
          </FormField>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FormField label="Contact Person Name" required>
              <Input
                value={form.contactName}
                onChange={(e) => handleChange('contactName', e.target.value)}
                required
              />
            </FormField>

            <FormField label="Contact Phone" required>
              <Input
                value={form.contactPhone}
                onChange={(e) => handleChange('contactPhone', e.target.value)}
                required
              />
            </FormField>
          </div>
        </div>

        {/* Form Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/donor')}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isLoading={loading}
          >
            Submit for Dispatch
          </Button>
        </div>
      </form>
    </div>
  );
}
