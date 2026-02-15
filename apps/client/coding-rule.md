Here is a concise, opinionated **React project coding style rule set** (2025–2026 edition) that emphasizes **arrow functions**, **shortest possible syntax**, cleanliness, and modern React patterns (works well with TypeScript too).

These rules assume you're using **React 18+ / 19**, **functional components + hooks**, **ESLint + Prettier**, and most likely **TypeScript**.

### 1. Component Definition (Mandatory)
- **Always** use arrow function for components
- Use **const** (never `let` or `function`)

```tsx
// Good (preferred)
const Button = ({ label }: Props) => {
  return <button>{label}</button>;
};

// Also acceptable (very small components)
const Badge = ({ count }: { count: number }) => <span className="badge">{count}</span>;

// Never do this in 2025+
function Button({ label }) { … }
```

### 2. Arrow Function Shorthand – Use maximally
Use the shortest valid syntax:

| Situation                        | Preferred (shortest) syntax                                 | When to avoid shorthand                          |
|----------------------------------|---------------------------------------------------------------------|--------------------------------------------------|
| No params                        | `() => …`                                                          | —                                                |
| One param, no type               | `item => …`                                                        | —                                                |
| One param + type                 | `(item: Item) => …`                                                | —                                                |
| Implicit return (JSX or expression) | `items => <div>{items.length}</div>`<br>`x => x * 2`              | When logic > 1 line or need `return` keyword     |
| Multi-line body                  | `items => { ... return …; }`                                       | —                                                |

Examples:

```tsx
// Great
const List = ({ items }) => (
  <ul>
    {items.map(item => <li key={item.id}>{item.name}</li>)}
  </ul>
);

// Good – when you need block
const fetchUser = async (id: string) => {
  const res = await fetch(`/api/users/${id}`);
  if (!res.ok) throw new Error("Failed");
  return res.json();
};

// Acceptable but longer than needed
const doubled = numbers.map((n) => { return n * 2; });   // ← avoid
```

### 3. JSX & Return Rules
- Prefer **implicit return** with parentheses `( )` for JSX
- Only use `{ return … }` when logic exists before/after JSX

```tsx
// Best
const Card = ({ title, children }) => (
  <div className="card">
    <h2>{title}</h2>
    {children}
  </div>
);

// OK – when there's logic
const Profile = ({ user }) => {
  if (!user) return <div>Loading...</div>;

  return (
    <div>
      <img src={user.avatar} alt={user.name} />
      <h1>{user.name}</h1>
    </div>
  );
};
```

### 4. Event Handlers & Callbacks
- Inline arrow functions **only** when very simple
- Prefer **stable named handlers** (especially if passed down)

```tsx
// Good – simple case
<button onClick={() => setOpen(true)}>Open</button>

// Better – avoids re-creation every render
const handleOpen = () => setOpen(true);

return <button onClick={handleOpen}>Open</button>;
```

### 5. Hooks & Dependencies
- Always write **full dependency array**
- Use **stable callbacks** with `useCallback` when passing to children / effects

```tsx
useEffect(() => {
  // ...
}, [id, debouncedSearch]);   // ← always list deps

const fetchData = useCallback(async () => {
  // ...
}, [id]);
```

### 6. Object / Array Shorthand
- Use shorthand properties & methods aggressively

```tsx
const user = { name, age, role: "admin" };           // good

// instead of
const user = { name: name, age: age, role: "admin" };
```

### 7. Destructuring
- Destructure **props** directly in parameters
- Avoid deep nesting in parameters (better to destructure inside)

```tsx
// Preferred
const ProductCard = ({ product: { name, price, image }, onAdd }) => { … }

// Acceptable (when many props)
const UserInfo = (props: UserProps) => {
  const { name, avatar, bio } = props;
  // ...
}
```

### 8. Naming & Conventions Quick List
- Components → **PascalCase**            `UserProfile`, `PriceTag`
- Files → **PascalCase.tsx**            `Button.tsx`, `UserList.tsx`
- Hooks → **camelCase starting with use**  `useUser`, `useDebounce`
- Variables & functions → **camelCase**
- Constants → **SCREAMING_SNAKE_CASE** (only true constants)

### 9. TypeScript Style (strongly recommended)
- Use **named exports** for types/interfaces
- Prefer inference when clean, explicit when clarity suffers

```tsx
type User = {
  id: string;
  name: string;
  email?: string;
};

interface Props {
  user: User;
  isLoading?: boolean;
}

const UserAvatar: React.FC<Props> = ({ user, isLoading = false }) => { … }
// or (more modern & lighter)
const UserAvatar = ({ user, isLoading = false }: Props) => { … }
```

### 10. Bonus Modern Preferences (2025+ vibe)
- Prefer **named exports** over `export default`
- Use **Server Components** / RSC when possible (Next.js)
- Prefer **tailwind** or **panda css / styled-system** over CSS-in-JS
- Use **useTransition** / **useDeferredValue** for better UX
- Avoid `any` — use `unknown` or proper generics
- Colocate **tests**, **stories**, **styles** (if using feature folders)

Would you like me to turn this into `.eslintrc` / `biome.json` rules (as much as possible), or do you want to add rules for folder structure, file naming, styling approach, testing, etc.? Let me know what you want to emphasize more! 😄