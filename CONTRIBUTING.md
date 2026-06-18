# Contributing to Shii-Edu Educational Platform

Thank you for considering contributing to Shii-Edu! We welcome contributions from the community to help improve this educational platform.

## How to Contribute

There are many ways to contribute to Shii-Edu:

1. **Report bugs** - Use the issue tracker to report problems
2. **Suggest features** - Share your ideas for new features or improvements
3. **Improve documentation** - Help make our docs better and more comprehensive
4. **Fix bugs** - Look through the issue tracker for bugs to fix
5. **Implement features** - Work on feature requests from the issue tracker
6. **Improve performance** - Help us make the platform faster and more efficient
7. **Review code** - Help review pull requests from other contributors

## Getting Started

### Setting Up Your Development Environment

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/your-username/educational-saas-app.git
   cd educational-saas-app
   ```
3. Set up the development environment following the instructions in [SETUP_GUIDE.md](SETUP_GUIDE.md)
4. Install dependencies:
   ```bash
   npm install
   npm run install:web
   npm run install:mobile
   ```

### Making Changes

1. Create a new branch for your work:
   ```bash
   git checkout -b feature-or-bugfix-name
   ```
   Use descriptive branch names:
   - `feature/` for new features
   - `fix/` for bug fixes
   - `docs/` for documentation changes
   - `refactor/` for code refactoring
   - `test/` for test-related changes

2. Make your changes, following our coding standards (see below)
3. Test your changes thoroughly
4. Commit your changes with clear, descriptive commit messages
5. Push to your fork and submit a pull request

## Coding Standards

### Code Style
- Follow the existing code style in the project
- Use 2 spaces for indentation (not tabs)
- End files with a newline
- Use descriptive variable and function names
- Prefer `const` and `let` over `var`
- Use arrow functions for concise callbacks
- Comment complex logic, but strive for self-documenting code

### Language-Specific Guidelines

#### TypeScript/JavaScript
- Use TypeScript for all new files (.ts for logic, .tsx for React components)
- Enable strict mode in tsconfig.json
- Define explicit types for function parameters and return values
- Use interfaces for object shapes
- Avoid `any` type when possible
- Use enum for fixed sets of values
- Prefer functional components over class components in React

#### React
- Use functional components with hooks
- Separate concerns: presentational vs container components
- Use PropTypes or TypeScript for component props
- Keep components small and focused
- Use React.memo for performance optimization when needed
- Follow hooks rules: only call hooks at top level, only in React functions

#### React Native
- Use Expo managed workflow
- Follow platform-specific guidelines when needed
- Test on both iOS and Android emulators/devices
- Use react-native-safe-area-context for safe area handling
- Optimize images and assets for mobile performance
- Use FlatList for large lists instead of ScrollView

#### CSS/Styling
- Use Tailwind CSS utility classes
- Create custom classes in @layer directives when needed
- Use responsive design prefixes (sm:, md:, lg:, etc.)
- Maintain consistent spacing using the theme spacing scale
- Use dark mode variants where appropriate
- Avoid !important when possible

### File Organization
- Place new components in appropriate directories under `src/components/`
- Group related files together
- Follow existing naming conventions
- Keep files reasonably sized (split large components)
- Use index.js/index.ts for barrel exports when appropriate
- Place styles in the same directory as components when component-specific
- Put shared styles in `src/styles/`

## Development Workflow

### Making Changes
1. Ensure your local environment is up to date:
   ```bash
   git checkout main
   git pull upstream main
   ```
2. Create your feature branch
3. Make small, frequent commits
4. Write clear commit messages:
   - First line: 50 characters or less, imperative mood
   - Blank line
   - Detailed explanation if needed (wrap at 72 characters)
   - Reference issue numbers if applicable: `Fixes #123`

### Testing
- Write unit tests for new logic using Jest
- Write integration tests for components using React Native Testing Library
- Test on multiple device sizes and platforms
- Test edge cases and error conditions
- Run the full test suite before submitting PR:
  ```bash
  npm test
  ```

### Code Review Process
1. Submit your pull request against the `main` branch
2. Fill out the PR template completely
3. Request reviews from maintainers
4. Address feedback promptly
5. Keep your branch updated with `main`:
   ```bash
   git pull upstream main
   ```
6. Once approved, maintainers will merge your PR
9. Delete your branch after merging:
   ```bash
   git branch -d feature-or-bugfix-name
   ```

## Reporting Issues

### Bug Reports
When reporting a bug, please include:
- Clear and descriptive title
- Steps to reproduce the issue
- Expected behavior vs actual behavior
- Screenshots or screen recordings if applicable
- Environment details:
  - Device type and OS version
  - Browser version (if web)
  - App version
- Any relevant logs or error messages

### Feature Requests
When suggesting a feature, please include:
- Clear description of the feature and its benefits
- Use cases or scenarios where it would be useful
- Any potential drawbacks or considerations
- Mockups or examples if available
- Priority level (low/medium/high)

## Community Guidelines

### Be Respectful
- Treat everyone with respect and kindness
- Value different perspectives and experiences
- Provide constructive feedback
- Welcome newcomers and help them get started

### Be Collaborative
- Work together to find the best solutions
- Share knowledge and help others learn
- Be open to feedback on your contributions
- Give credit where it's due

### Stay Focused
- Keep discussions on topic
- Respect maintainers' time and decisions
- Follow the project roadmap when possible
- Be patient - good things take time

## Licensing

By contributing to Shii-Edu, you agree that your contributions will be licensed under the MIT License, the same license used by the project.

## Questions?

If you have questions or need help:
1. Check the existing documentation
2. Search open and closed issues
3. Ask in the project discussions
4. Reach out to maintainers directly

Thank you for contributing to Shii-Edu and helping make education better for everyone!