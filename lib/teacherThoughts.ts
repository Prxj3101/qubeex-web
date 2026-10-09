// Teacher "Thought of the Day" - shown on the Overview blackboard and on the classroom board.
// Same thought for everyone on a given day.
export const THOUGHTS = [
    { text: "Teaching is the greatest act of optimism.", author: "William Arthur Ward" },
    { text: "The mediocre teacher tells. The good teacher explains. The superior teacher demonstrates. The great teacher inspires.", author: "Colleen Wilcox" },
    { text: "A good teacher can inspire hope, ignite the imagination, and instill a love of learning.", author: "Brad Henry" },
    { text: "The art of teaching is the art of assisting discovery.", author: "Mark Van Doren" },
    { text: "Teachers, I believe, are the most responsible and important members of society.", author: "Kurt Vonnegut" },
];

export function getTodaysThought() {
    const today = new Date();
    const day = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
    return THOUGHTS[day % THOUGHTS.length];
}

