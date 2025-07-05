import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { db } from "../firebase";
import {
  collection,
  addDoc,
  getDocs,
  query,
  where,
  Timestamp,
  deleteDoc,
  doc,
} from "firebase/firestore";
import { auth } from "../firebase"; // adjust if your auth hook is elsewhere
import { Logout } from "./logout";
import { Trash2 } from "lucide-react";

type Board = {
  _id: string;
  name: string;
  _creationTime: number;
  shareId?: string;
};

export default function BoardSelect() {
  const [newBoardName, setNewBoardName] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const user = auth.currentUser; // assumes you have a user object with uid

  // Fetch boards
  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const fetchBoards = async () => {
      const q = query(
        collection(db, "boards"),
        where("userId", "==", user.uid)
      );
      const querySnapshot = await getDocs(q);
      const boardsData: Board[] = [];
      querySnapshot.forEach((doc) => {
        const data = doc.data();
        boardsData.push({
          _id: doc.id,
          name: data.name,
          _creationTime: data._creationTime?.toMillis?.() || Date.now(),
          shareId: data.shareId,
        });
      });
      setBoards(boardsData);
      setLoading(false);
    };
    fetchBoards();
  }, [user]);

  // Create board
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardName.trim() || !user) return;

    setIsCreating(true);
    try {
      const docRef = await addDoc(collection(db, "boards"), {
        name: newBoardName.trim(),
        userId: user.uid,
        _creationTime: Timestamp.now(),
        shareId: crypto.randomUUID(), // or any share id logic
        notes: [], // Initialize with empty notes array
      });
      navigate(`/boards/${docRef.id}`);
      toast.success("Board created successfully!");
      setBoards((prev) => [
        ...prev,
        {
          _id: docRef.id,
          name: newBoardName.trim(),
          _creationTime: Date.now(),
          shareId: "", // update if you use shareId
        },
      ]);
    } catch {
      toast.error("Failed to create board");
    } finally {
      setIsCreating(false);
      setNewBoardName("");
    }
  };

  const copyShareLink = (boardId: string) => {
    const url = `${window.location.origin}/noteboard-app/boards/${boardId}`;
    navigator.clipboard.writeText(url);
    toast.success("Share link copied to clipboard!");
  };

  const handleDeleteBoard = (boardId: string) => {
    const boardRef = doc(db, "boards", boardId);
    deleteDoc(boardRef);
    toast.success("Board deleted successfully!");
    setBoards(boards.filter((board) => board._id !== boardId));
  };

  return (
    <div className="space-y-6 flex flex-col items-center justify-center h-screen">
      <Logout />
      <h1 className="!text-5xl font-bold text-center text-blue-600">
        Collaboard
      </h1>
      <p className="text-gray-500 text-center mb-10">
        Welcome Back {user?.email}
      </p>
      <form
        onSubmit={handleCreateBoard}
        className="flex gap-2 max-w-md mx-auto"
      >
        <input
          type="text"
          value={newBoardName}
          onChange={(e) => setNewBoardName(e.target.value)}
          placeholder="Board name..."
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isCreating}
        />
        <button
          type="submit"
          disabled={!newBoardName.trim() || isCreating}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {isCreating ? "Creating..." : "Create Board"}
        </button>
      </form>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {boards.map((board) => (
          <div
            key={board._id}
            className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow"
          >
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold mb-2">{board.name}</h3>
              <button
                className="text-gray-500 hover:text-gray-700"
                onClick={() => handleDeleteBoard(board._id)}
              >
                <Trash2 className="w-5 h-5 text-red-500 mb-2 cursor-pointer hover:text-red-800" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Created {new Date(board._creationTime).toLocaleDateString()}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate(`/boards/${board._id}`)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 cursor-pointer"
              >
                Open
              </button>
              <button
                onClick={() => copyShareLink(board._id)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 cursor-pointer"
              >
                Share
              </button>
            </div>
          </div>
        ))}
      </div>

      {boards.length === 0 && !loading && (
        <div className="text-center py-12">
          <p className="text-gray-500">
            No boards yet. Create your first board above!
          </p>
        </div>
      )}
    </div>
  );
}
