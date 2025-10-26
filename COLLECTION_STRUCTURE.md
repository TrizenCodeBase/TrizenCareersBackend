# Database Collection Structure

## Overview

The application system now uses **separate collections for each job role** instead of a single collection. This provides better organization, improved performance, and easier maintenance.

## Collection Mapping

| Job ID | Collection Name | Description |
|--------|----------------|-------------|
| `TV-AIML-INT-2025-001` | `aiml_applications` | AIML Intern applications |
| `TV-WEB-MERN-2025-005` | `mern_applications` | MERN Stack Developer Intern applications |
| `TV-MKT-SMM-2025-003` | `social_media_applications` | Social Media Management Intern applications |

## Benefits

### 1. **Better Organization**
- Each role has its own dedicated collection
- Easier to manage role-specific data structures
- Clear separation of concerns

### 2. **Improved Performance**
- Smaller collections = faster queries
- Role-specific indexes
- Better scalability

### 3. **Easier Maintenance**
- Role-specific validation rules
- Independent schema evolution
- Easier debugging and monitoring

### 4. **Better Security**
- Role-based access control
- Isolated data per role
- Easier compliance management

## Schema Structure

### Base Schema (Common Fields)
All collections share these common fields:
- `fullName` - Applicant's full name
- `email` - Email address
- `phone` - Phone number
- `location` - Location
- `linkedinProfile` - LinkedIn profile URL
- `motivation` - Motivation to join
- `expectedStipend` - Expected stipend amount
- `status` - Application status (pending, reviewed, shortlisted, rejected, accepted)
- `appliedBy` - Reference to User model
- `createdAt` - Application timestamp
- `updatedAt` - Last update timestamp

### Role-Specific Fields

#### AIML Intern (`aiml_applications`)
- `portfolioUrl` - Portfolio URL
- `resumeLink` - Resume link
- `educationStatus` - Education status
- `degreeDiscipline` - Degree discipline
- `researchPapers` - Research papers information
- `internshipExperience` - Internship experience
- `duration` - Preferred duration
- `aiMlProjects` - AI/ML projects information

#### MERN Stack Developer Intern (`mern_applications`)
- Same fields as AIML Intern (shared technical requirements)

#### Social Media Management Intern (`social_media_applications`)
- `currentQualification` - Current qualification
- `collegeUniversity` - College/University name
- `relevantCourses` - Relevant courses
- `socialMediaPlatforms` - Array of social media platforms
- `contentCreationSkills` - Array of content creation skills
- `portfolioWorkSamples` - Portfolio/work samples link
- `resumeLink` - Resume link
- `preferredStartDate` - Preferred start date
- `workPreference` - Work preference (Hybrid, Remote, Office)
- `internshipExperience` - Internship experience
- `hoursPerWeek` - Hours per week
- `expectations` - Expectations

## API Usage

### Creating Applications
```javascript
// The system automatically selects the correct collection based on jobId
const application = await ApplicationModel.create({
  jobId: 'TV-AIML-INT-2025-001', // Automatically routes to aiml_applications
  fullName: 'John Doe',
  email: 'john@example.com',
  // ... other fields
});
```

### Querying Applications
```javascript
// Get applications for a specific role
const aimlApplications = await ApplicationModel.find({ status: 'pending' });

// Get all applications across all roles
const allApplications = await getAllApplicationModels();
```

## Migration

### From Single Collection to Role-Based Collections

1. **Run Migration Script**:
   ```bash
   node src/scripts/migrateApplications.js
   ```

2. **Verify Migration**:
   - Check that applications are in correct collections
   - Verify data integrity
   - Test API endpoints

3. **Clean Up** (Optional):
   - Remove old single collection after verification

## Adding New Roles

To add a new role:

1. **Add to Collection Mapping**:
   ```javascript
   const COLLECTION_MAPPING = {
     'TV-AIML-INT-2025-001': 'aiml_applications',
     'TV-WEB-MERN-2025-005': 'mern_applications',
     'TV-MKT-SMM-2025-003': 'social_media_applications',
     'NEW-JOB-ID': 'new_role_applications' // Add new mapping
   };
   ```

2. **Create Schema**:
   ```javascript
   const newRoleSchema = new mongoose.Schema({
     ...baseApplicationSchema.obj,
     // Add role-specific fields
   });
   ```

3. **Add to Schema Mapping**:
   ```javascript
   const SCHEMA_MAPPING = {
     // ... existing mappings
     'NEW-JOB-ID': newRoleSchema
   };
   ```

## Monitoring and Analytics

### Collection Statistics
```javascript
// Get application counts per role
const stats = {};
for (const [jobId, collectionName] of Object.entries(COLLECTION_MAPPING)) {
  const model = getApplicationModel(jobId);
  stats[jobId] = await model.countDocuments();
}
```

### Performance Monitoring
- Monitor query performance per collection
- Track collection sizes
- Monitor index usage

## Best Practices

1. **Always use the factory function** to get the correct model
2. **Validate jobId** before creating applications
3. **Use appropriate indexes** for each collection
4. **Monitor collection sizes** and performance
5. **Keep schemas consistent** across similar roles

## Troubleshooting

### Common Issues

1. **Unsupported Job ID Error**:
   - Ensure jobId is added to COLLECTION_MAPPING
   - Check for typos in jobId

2. **Schema Validation Errors**:
   - Verify required fields for each role
   - Check field types and constraints

3. **Migration Issues**:
   - Check MongoDB connection
   - Verify existing data structure
   - Run migration in batches for large datasets
