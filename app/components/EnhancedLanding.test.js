/* global describe, expect, it */

const fs = require('fs');
const path = require('path');

describe('landing honesty and actions', () => {
  it('does not ship fake named reviews and keeps hero CTAs actionable', () => {
    const landing = fs.readFileSync(path.join(process.cwd(), 'app', 'components', 'EnhancedLanding.jsx'), 'utf8');
    const slider = fs.readFileSync(path.join(process.cwd(), 'app', 'components', 'ui', 'TestimonialSlider.jsx'), 'utf8');

    expect(landing).not.toContain('What institutes are saying');
    expect(landing).not.toContain('Join hundreds of institutes');
    expect(landing).toContain('href="/roles"');
    expect(landing).toContain('mailto:sashimiofficials@gmail.com');

    expect(slider).not.toMatch(/Dr\.|Principal|Greenwood|Sunshine|Unity Academy|Horizon Institute|Rajesh|Meera|Anil/);
    expect(slider).toContain('LaunchEvidenceSlider');
  });
});
