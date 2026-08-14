namespace ArcaneLink.Services.Validators.Abstractions
{
    public interface IValidator<T>
    {
        public Task<bool> Validate(T validatedObject);
    }
}
