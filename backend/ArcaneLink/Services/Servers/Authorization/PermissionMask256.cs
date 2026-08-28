using System.Buffers.Binary;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace ArcaneLink.Services.Servers.Authorization
{
    [JsonConverter(typeof(PermissionMask256JsonConverter))]
    public readonly struct PermissionMask256 : IEquatable<PermissionMask256>
    {
        public const int BitCapacity = 256;
        public const int ByteLength = BitCapacity / 8;

        private readonly ulong _word0;
        private readonly ulong _word1;
        private readonly ulong _word2;
        private readonly ulong _word3;

        private PermissionMask256(
            ulong word0,
            ulong word1,
            ulong word2,
            ulong word3)
        {
            this._word0 = word0;
            this._word1 = word1;
            this._word2 = word2;
            this._word3 = word3;
        }

        public static PermissionMask256 Empty => default;

        public bool IsEmpty =>
            this._word0 == 0 &&
            this._word1 == 0 &&
            this._word2 == 0 &&
            this._word3 == 0;

        public bool Contains(int bit)
        {
            ValidateBit(bit);
            var flag = 1UL << (bit & 63);

            return (bit >> 6) switch
            {
                0 => (this._word0 & flag) != 0,
                1 => (this._word1 & flag) != 0,
                2 => (this._word2 & flag) != 0,
                _ => (this._word3 & flag) != 0
            };
        }

        public PermissionMask256 With(int bit)
        {
            ValidateBit(bit);
            var flag = 1UL << (bit & 63);

            return (bit >> 6) switch
            {
                0 => new(this._word0 | flag, this._word1, this._word2, this._word3),
                1 => new(this._word0, this._word1 | flag, this._word2, this._word3),
                2 => new(this._word0, this._word1, this._word2 | flag, this._word3),
                _ => new(this._word0, this._word1, this._word2, this._word3 | flag)
            };
        }

        public PermissionMask256 Without(int bit)
        {
            ValidateBit(bit);
            var flag = ~(1UL << (bit & 63));

            return (bit >> 6) switch
            {
                0 => new(this._word0 & flag, this._word1, this._word2, this._word3),
                1 => new(this._word0, this._word1 & flag, this._word2, this._word3),
                2 => new(this._word0, this._word1, this._word2 & flag, this._word3),
                _ => new(this._word0, this._word1, this._word2, this._word3 & flag)
            };
        }

        public PermissionMask256 Except(PermissionMask256 denied)
        {
            return new(
                this._word0 & ~denied._word0,
                this._word1 & ~denied._word1,
                this._word2 & ~denied._word2,
                this._word3 & ~denied._word3);
        }

        public byte[] ToByteArray()
        {
            var bytes = new byte[ByteLength];
            BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(0, 8), this._word0);
            BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(8, 8), this._word1);
            BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(16, 8), this._word2);
            BinaryPrimitives.WriteUInt64LittleEndian(bytes.AsSpan(24, 8), this._word3);
            return bytes;
        }

        public static PermissionMask256 FromByteArray(ReadOnlySpan<byte> bytes)
        {
            if (bytes.Length != ByteLength)
            {
                throw new ArgumentException(
                    $"A permission mask must contain exactly {ByteLength} bytes.",
                    nameof(bytes));
            }

            return new(
                BinaryPrimitives.ReadUInt64LittleEndian(bytes.Slice(0, 8)),
                BinaryPrimitives.ReadUInt64LittleEndian(bytes.Slice(8, 8)),
                BinaryPrimitives.ReadUInt64LittleEndian(bytes.Slice(16, 8)),
                BinaryPrimitives.ReadUInt64LittleEndian(bytes.Slice(24, 8)));
        }

        public static PermissionMask256 FromBits(IEnumerable<int> bits)
        {
            ArgumentNullException.ThrowIfNull(bits);

            var mask = Empty;
            foreach (var bit in bits)
            {
                mask = mask.With(bit);
            }

            return mask;
        }

        public static PermissionMask256 operator |(
            PermissionMask256 left,
            PermissionMask256 right)
        {
            return new(
                left._word0 | right._word0,
                left._word1 | right._word1,
                left._word2 | right._word2,
                left._word3 | right._word3);
        }

        public static PermissionMask256 operator &(
            PermissionMask256 left,
            PermissionMask256 right)
        {
            return new(
                left._word0 & right._word0,
                left._word1 & right._word1,
                left._word2 & right._word2,
                left._word3 & right._word3);
        }

        public bool Equals(PermissionMask256 other)
        {
            return this._word0 == other._word0 &&
                   this._word1 == other._word1 &&
                   this._word2 == other._word2 &&
                   this._word3 == other._word3;
        }

        public override bool Equals(object? obj)
        {
            return obj is PermissionMask256 other && this.Equals(other);
        }

        public override int GetHashCode()
        {
            return HashCode.Combine(this._word0, this._word1, this._word2, this._word3);
        }

        public static bool operator ==(
            PermissionMask256 left,
            PermissionMask256 right)
        {
            return left.Equals(right);
        }

        public static bool operator !=(
            PermissionMask256 left,
            PermissionMask256 right)
        {
            return !left.Equals(right);
        }

        private static void ValidateBit(int bit)
        {
            if ((uint)bit >= BitCapacity)
            {
                throw new ArgumentOutOfRangeException(
                    nameof(bit),
                    bit,
                    $"Permission bit must be between 0 and {BitCapacity - 1}.");
            }
        }
    }

    public sealed class PermissionMask256JsonConverter
        : JsonConverter<PermissionMask256>
    {
        public override PermissionMask256 Read(
            ref Utf8JsonReader reader,
            Type typeToConvert,
            JsonSerializerOptions options)
        {
            if (reader.TokenType != JsonTokenType.String)
            {
                throw new JsonException("A permission mask must be a base64 string.");
            }

            try
            {
                var bytes = reader.GetBytesFromBase64();
                return PermissionMask256.FromByteArray(bytes);
            }
            catch (FormatException exception)
            {
                throw new JsonException("The permission mask is not valid base64.", exception);
            }
            catch (ArgumentException exception)
            {
                throw new JsonException(exception.Message, exception);
            }
        }

        public override void Write(
            Utf8JsonWriter writer,
            PermissionMask256 value,
            JsonSerializerOptions options)
        {
            writer.WriteBase64StringValue(value.ToByteArray());
        }
    }
}
