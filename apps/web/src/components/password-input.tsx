import { Input } from "@PhotoPrinting/ui/components/input";
import { Eye, EyeOff } from "lucide-react";
import { type ComponentProps, useState } from "react";

export default function PasswordInput(
	props: Omit<ComponentProps<typeof Input>, "type">,
) {
	const [visible, setVisible] = useState(false);
	return (
		<div className="password-input">
			<Input {...props} type={visible ? "text" : "password"} />
			<button
				type="button"
				className="password-input__toggle"
				aria-label="Show password"
				aria-pressed={visible}
				aria-controls={props.id}
				onClick={() => setVisible((current) => !current)}
			>
				{visible ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
			</button>
		</div>
	);
}
